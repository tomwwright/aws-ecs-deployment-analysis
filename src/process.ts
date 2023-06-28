import { convertToHash, groupBy, mergeHashes, parseCSV } from "./util";

const STATE = {
  numServices: 0,
  missingTaskLookups: 0,
  discardedEventsNoMatch: 0,
  discardedEventsNoTimeline: 0,
  discardedTimelinesCloudformationOnly: 0,
  discardedTimelinesMultipleStartsOrStops: 0,
  discardedTimelinesUpdateFailed: 0,
  timelines: 0,
};

const date = process.argv[2];

const starts = parseCSV("data/started-tasks.csv");
const stops = parseCSV("data/stopped-tasks.csv");
const events = parseCSV(`data/deploy-events-${date}.csv`).map((data) => ({
  ...(data as Event),
  timestamp: new Date(data["timestamp"]).toISOString(),
}));

const lookup = mergeHashes(
  convertToHash(starts, "detail.taskArn"),
  convertToHash(stops, "detail.taskArn")
);

const timelines = constructTimelines(events);
writeTimelinesCsv(timelines);

console.error("stats", {
  ...STATE,
  processedStarts: starts.length,
  processedStops: stops.length,
  processedEvents: events.length,
});

type Event = {
  timestamp: string;
  serviceArn: string;
  message: string;
};

function writeTimelinesCsv(timelines: Iterable<Timeline>) {
  const headers: (keyof Timeline)[] = [
    "serviceArn",
    "targetGroupArn",
    "cloudformationStart",
    "ecsStart",
    "taskCreated",
    "taskConnect",
    "taskPullStart",
    "taskPullStop",
    "ecsRegister",
    "taskStart",
    "taskStopping",
    "taskExecutionStop",
    "taskStop",
    "ecsDeregister",
    "ecsStop",
    "ecsDeploymentComplete",
    "cloudformationEnd",
  ];
  console.log(headers.join(","));
  for (const timeline of timelines) {
    console.log(writeCsv(timeline, headers));
  }
}

function* constructTimelines(events: Event[]) {
  const eventsByService = groupBy(events, "serviceArn", "timestamp");
  STATE.numServices = Object.keys(eventsByService).length;

  for (const events of Object.values(eventsByService)) {
    const timelines = constructTimelinesForService(events);
    for (const timeline of timelines) {
      if (!timeline.ecsStart || !timeline.ecsStop) {
        STATE.discardedTimelinesCloudformationOnly++;
        continue;
      }

      STATE.timelines++;
      yield timeline;
    }
  }
}

/**
 * Generate timelines from an ordered list of events
 *
 * Start recording events when we see a UPDATE_IN_PROGRESS event
 * and parse it when we see a UPDATE_COMPLETE or discard it when
 * we see UPDATE_FAILED
 *
 *
 * @param events List of events to construct timelines from
 */
function* constructTimelinesForService(events: Event[]) {
  let stack: Event[] = [];
  let capturingTimeline = false;
  for (const event of events) {
    try {
      if (event.message === "UPDATE_IN_PROGRESS") {
        capturingTimeline = true;
      }

      if (capturingTimeline) {
        stack.push(event);

        if (event.message === "UPDATE_COMPLETE") {
          yield constructTimeline(stack);
          capturingTimeline = false;
          stack = [];
        }

        if (event.message === "UPDATE_FAILED") {
          STATE.discardedTimelinesUpdateFailed++;
          capturingTimeline = false;
          stack = [];
        }
      } else {
        STATE.discardedEventsNoTimeline++;
      }
    } catch (e) {
      console.error(`Failed to process event: ${JSON.stringify(event)}`);
      throw e;
    }
  }
}

type Timeline = {
  serviceArn: string;
  targetGroupArn?: string;
  cloudformationStart?: string;
  ecsStart?: string;
  taskCreated?: string;
  taskConnect?: string;
  taskPullStart?: string;
  taskPullStop?: string;
  ecsRegister?: string;
  taskStart?: string;
  taskStopping?: string;
  taskExecutionStop?: string;
  taskStop?: string;
  ecsDeregister?: string;
  ecsStop?: string;
  ecsDeploymentComplete?: string;
  cloudformationEnd?: string;
};

function constructTimeline(events: Event[]): Timeline {
  // for now only handle "simple" deployments with a single start and stop

  if (hasMultipleEvents(events, /started/)) {
    STATE.discardedTimelinesMultipleStartsOrStops++;
  }

  if (hasMultipleEvents(events, /stopped/)) {
    STATE.discardedTimelinesMultipleStartsOrStops++;
  }

  const timeline: Timeline = {
    serviceArn: events[0].serviceArn,
  };
  for (const event of events) {
    parseEvent(event, timeline);
  }

  return timeline;
}

function hasMultipleEvents(events: Event[], pattern: RegExp) {
  return events.filter((event) => pattern.test(event.message)).length > 1;
}

function lookupTask(serviceArn: string, id: string) {
  const [arn, cluster, name] = serviceArn.split("/");
  const taskArn = `${arn.replace("service", "task")}/${cluster}/${id}`;
  const task = lookup[taskArn];
  if (!task) {
    STATE.missingTaskLookups++;
  }
  return task;
}

function parseEvent(event: Event, timeline: Timeline) {
  if (event.message === "UPDATE_IN_PROGRESS") {
    timeline.cloudformationStart = event.timestamp;
    return;
  }

  if (event.message === "UPDATE_COMPLETE") {
    timeline.cloudformationEnd = event.timestamp;
    return;
  }

  const started = event.message.match(/started 1 tasks: \(task (.+)\)/);
  if (started) {
    timeline.ecsStart = event.timestamp;
    const taskId = started[1];
    const task = lookupTask(event.serviceArn, taskId);
    if (task) {
      timeline.taskCreated = task["detail.createdAt"];
      timeline.taskConnect = task["detail.connectivityAt"];
      timeline.taskStart = task["detail.startedAt"];
      timeline.taskPullStart = task["detail.pullStartedAt"];
      timeline.taskPullStop = task["detail.pullStoppedAt"];
    }
    return;
  }

  const isStopped = event.message.match(
    /stopped 1 running tasks: \(task (.+)\)/
  );
  if (isStopped) {
    timeline.ecsStop = event.timestamp;
    const taskId = isStopped[1];
    const task = lookupTask(event.serviceArn, taskId);
    if (task) {
      timeline.taskExecutionStop = task["detail.executionStoppedAt"];
      timeline.taskStopping = task["detail.stoppingAt"];
      timeline.taskStop = task["detail.stoppedAt"];
    }

    return;
  }

  const isDeregistered = event.message.match(
    /deregistered 1 targets in \(target-group (.+)\)/
  );
  if (isDeregistered) {
    timeline.ecsDeregister = event.timestamp;
    timeline.targetGroupArn = isDeregistered[1];
    return;
  }

  const isRegistered = event.message.match(
    /registered 1 targets in \(target-group (.+)\)/
  );
  if (isRegistered) {
    timeline.ecsRegister = event.timestamp;
    timeline.targetGroupArn = isRegistered[1]; // potentially already assigned via deregister event but w/e
    return;
  }

  if (event.message.includes("deployment completed")) {
    timeline.ecsDeploymentComplete = event.timestamp;
    return;
  }

  STATE.discardedEventsNoMatch++;
}

function writeCsv(timeline: Timeline, headers: (keyof Timeline)[]) {
  return headers.map((header) => timeline[header]).join(",");
}
