#!/bin/bash

echo "Creating $1"
echo "apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: $SERVICE
spec:
  template:
    spec:
      timeoutSeconds: 300
      containers:
      - image: $IMAGE
        ports:
        - name: http1
          containerPort: 8080
        env:" > $1

echo "Appending environment variables to $1"
perl -E'
  say "        - name: $_
          value: \x27$ENV{$_}\x27" for @ARGV;
' NODE_ENV \
    LEADERLIB_PRIVATE_KEY_HEX >> $1

echo "Built! Contents of $1:"
cat $1
