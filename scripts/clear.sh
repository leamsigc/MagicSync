#!/bin/bash

# Clear all node_modules in the current directory and in the packages sub directory

find . -type d -name "node_modules" -print0 | xargs -0 rm -rf
find packages -type d -name "node_modules" -print0 | xargs -0 rm -rf

# Delete all the .nuxt,.output folder in the packages sub directory .playground sub directory
find . -type d -name ".nuxt" -print0 | xargs -0 rm -rf
find . -type d -name ".output" -print0 | xargs -0 rm -rf