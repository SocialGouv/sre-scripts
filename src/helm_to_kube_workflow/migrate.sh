#!/bin/bash

set -u
set -x
set -o pipefail


WORKING_DIR=$(pwd)
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )


echo "---- Starting migration in dir $WORKING_DIR"

git checkout -b sre/migrate-to-kube-workflow

mkdir -p .kube-workflow/common/templates

for e in dev preprod prod
do
    mkdir -p .kube-workflow/env/$e/templates
done

mv .socialgouv/chart/values.project.yaml .kube-workflow/common/values.yaml

for e in dev preprod prod
do
    mv .socialgouv/environments/$e/*.{configmap,sealed-secret}.yaml .kube-workflow/env/$e/templates
done

for file in review preproduction production
do
    if ! grep -q "kube-workflow" ".github/workflows/$file.yml"; then
        cp $SCRIPT_DIR/.github/workflows/$file.yml .github/workflows/$file.yml
    fi
done

mv .socialgouv/__tests__ .kube-workflow/__tests__

git add .kube-workflow
git add .socialgouv
git add .github