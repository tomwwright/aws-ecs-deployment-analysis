#!/bin/bash

for ((i=1;i<=20;i++)); 
do 
  echo ""
  echo ""
  echo "[+] Performing deploy: ${i}"
  echo ""
  echo ""
  VERSION=${i} pnpm cdk deploy --method direct
done