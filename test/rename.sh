#!/bin/bash

if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <directory_path> <old_prefix> <new_prefix>"
    exit 1
fi

directory_path="$1"
old_prefix="$2"
new_prefix="$3"

cd "$directory_path" || exit 1

for file in "$old_prefix"*; do
    if [ -e "$file" ]; then
        new_name="${file/$old_prefix/$new_prefix}"
        cp "$file" "$new_name"
        echo "cp $file $new_name"
    fi
done