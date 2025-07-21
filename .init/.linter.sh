#!/bin/bash
cd /home/kavia/workspace/code-generation/conways-life-simulator-cc2b3514/game_of_life_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

