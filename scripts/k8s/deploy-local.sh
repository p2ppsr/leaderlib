#!/usr/bin/env bash
set -euo pipefail

if [[ "${ENVIRONMENT:-}" != "prod" && "${ENVIRONMENT:-}" != "production" ]]; then
  echo "ENVIRONMENT=prod is required" >&2
  exit 2
fi

if [[ -z "${IMAGE_TAG:-}" ]]; then
  if [[ -z "${SOURCE_SHA:-}" ]]; then
    echo "IMAGE_TAG or SOURCE_SHA is required" >&2
    exit 2
  fi
  IMAGE_TAG="${SOURCE_SHA:0:12}-prod-$(date -u +%F)"
fi

repo_root="$(git rev-parse --show-toplevel)"
registry_pull="${REGISTRY_PULL:-registry.cars-operator-system.svc.cluster.local:5000}"
kubectl_cmd="${KUBECTL:-kubectl}"
tmp_dir="$(mktemp -d)"
cleanup() { rm -rf "${tmp_dir}"; }
trap cleanup EXIT

mkdir -p "${tmp_dir}/infra"
cp -R "${repo_root}/infra/kubernetes" "${tmp_dir}/infra/kubernetes"

overlay_dir="${tmp_dir}/infra/kubernetes/overlays/prod"
kustomization="${overlay_dir}/kustomization.yaml"

export IMAGE_TAG REGISTRY_PULL="${registry_pull}"
perl -0pi -e 's#newName: [^\n]*/p2ppsr/leaderlib-server#newName: $ENV{REGISTRY_PULL}/p2ppsr/leaderlib-server#g' "${kustomization}"
perl -0pi -e 's#newTag: [^\n]+#newTag: $ENV{IMAGE_TAG}#g' "${kustomization}"

"${kubectl_cmd}" apply -f "${overlay_dir}/namespace.yaml"
"${kubectl_cmd}" kustomize "${overlay_dir}" | "${kubectl_cmd}" apply -f -
"${kubectl_cmd}" -n leaderlib-prod rollout status deployment/leaderlib --timeout=15m
"${kubectl_cmd}" -n leaderlib-prod wait --for=condition=Ready certificate/leaderlib-tls --timeout=15m

"${kubectl_cmd}" -n leaderlib-prod run "leaderlib-smoke-$(date +%s)" \
  --quiet \
  --rm \
  -i \
  --restart=Never \
  --image=curlimages/curl:8.11.1 \
  --command -- curl --fail --show-error --silent http://leaderlib:8080/health

printf 'leaderlib prod deployment completed for image tag %s\n' "${IMAGE_TAG}"
