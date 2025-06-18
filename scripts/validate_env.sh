#!/bin/bash

# Simple environment file validator
# Usage: validate_env.sh <env-file> [<env-file> ...]

THRESHOLD=200

validate_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "Warning: $file not found"
    return
  fi
  local lineno=0
  while IFS= read -r line || [ -n "$line" ]; do
    lineno=$((lineno+1))
    # Skip empty lines and comments
    if [[ -z "$line" || "$line" =~ ^# ]]; then
      continue
    fi
    if [[ ! "$line" =~ ^[A-Za-z0-9_]+= ]]; then
      echo "Invalid syntax in $file at line $lineno: $line"
    fi
    if [ ${#line} -gt $THRESHOLD ]; then
      echo "Line $lineno in $file exceeds $THRESHOLD characters"
    fi
  done < "$file"
}

for envfile in "$@"; do
  validate_file "$envfile"
  done
