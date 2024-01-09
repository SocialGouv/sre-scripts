#!/usr/bin/env zx

const fabContexts = ["dev", "prod", "ovh-dev", "ovh-prod"];
const port = "54321";

$.verbose = false;

const { stdout: localContexts } = await $`kubectl config get-contexts -o name`;
const selectedContexts = localContexts
  .trim()
  .split("\n")
  .filter((c) => fabContexts.includes(c));

const myCnpgClusters = await Promise.all(
  selectedContexts.map(async (context) => {
    const { stdout: pgClusters } =
      await $`kubectl get --context=${context} -A clusters.postgresql.cnpg.io --no-headers -o=jsonpath='{range .items[*]}{@.metadata.namespace}{"|"}{@.metadata.name}{"\\n"}{end}'`;
    return pgClusters
      .trim()
      .split("\n")
      .map((cluster) => {
        const [ns, name] = cluster.split("|");
        return { context, ns, name };
      });
  }),
);

$.verbose = true;

const fzfClusters = [].concat
  .apply([], myCnpgClusters)
  .map((cluster) => {
    return `${cluster.context} | ${cluster.ns} | ${cluster.name}`;
  })
  .join("\n");

const { stdout: selectedClusterAsString } = await $`echo ${fzfClusters} | fzf`;

const [context, ns, name] = selectedClusterAsString.trim().split(" | ");

const { stdout: dbUrl } =
  await $`kubectl get --context ${context} -n ${ns} secret ${name}-app -o jsonpath="{.data.DATABASE_URL}" | base64 --decode`;

console.log(`

DATABASE_URL:

${dbUrl
  .replace("sslmode=require", "sslmode=disable")
  .replace(`@${name}-rw:5432`, `@localhost:${port}`)}
`);

$`kubectl --context ${context} -n ${ns} port-forward svc/${name}-rw ${port}:5432`;