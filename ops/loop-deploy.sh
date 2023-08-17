#!/bin/bash

# first for creation, then 15 updates to generate data
# 15 because ECS Service events max at 100, and each deploy takes 5-7 events
for ((i=1;i<=16;i++)); 
do 
  echo ""
  echo ""
  echo "[+] Performing deploy: ${i}"
  echo ""
  echo ""
  VERSION=${i} pnpm cdk deploy --method direct
done