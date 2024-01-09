#!/usr/bin/env zx

const projectSubString = process.argv[3] || "";

const fabContexts = ["dev", "prod", "ovh-dev", "ovh-prod"];
const port = "54321";

$.verbose = false;

const { stdout: localContexts } = await $`kubectl config get-contexts -o name`;
const selectedContexts = localContexts
  .trim()
  .split("\n")
  .filter((c) => fabContexts.includes(c));

let myCnpgClusters = [];

try {
  // for cluster admins
  myCnpgClusters = await Promise.all(
    selectedContexts.map(async (context) => {
      const { stdout: services } =
        await $`kubectl get --context=${context} -A svc -o jsonpath='{range .items[*]}{@.metadata.namespace}{"|"}{@.metadata.name}{"\\n"}{end}' | grep "\\-rw"`;
      return services
        .trim()
        .split("\n")
        .map((cluster) => {
          const [ns, name] = cluster.split("|");
          return {
            context,
            ns,
            name: name.replace("service/", "").replace("-rw", ""),
          };
        });
    }),
  );
} catch (e) {
  // for non-admin user that has not the permission to list all cnpg clusters

  myCnpgClusters = await Promise.all(
    selectedContexts.map(async (context) => {
      const { stdout: rawNamespaces } =
        await $`kubectl get --context=${context} ns -o name`;

      const namespaces = rawNamespaces
        .trim()
        .split("\n")
        .filter((ns) => ns.includes(projectSubString))
        .map((ns) => ns.replace("namespace/", ""));

      const clusters = await Promise.all(
        namespaces.map(async (ns) => {
          try {
            const { stdout: services } =
              await $`kubectl get --context=${context} -n ${ns} svc -o name | grep "\\-rw"`;
            return services
              .trim()
              .split("\n")
              .map((name) => {
                return {
                  context,
                  ns,
                  name: name.replace("service/", "").replace("-rw", ""),
                };
              });
          } catch (e) {
            // no permission in this namespace
            return [];
          }
        }),
      );
      return [].concat.apply([], clusters);
    }),
  );
}

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
