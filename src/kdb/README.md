# kdb

Script qui permet de choisir un CNPG parmi tous ceux auxquels on a accès, puis de lancer le port-forward et afficher la DATABASE_URL adaptée au localhost.

Utilisation :

- installer en global [zx](https://google.github.io/zx/getting-started)
- installer [fzf](https://github.com/junegunn/fzf)
- cloner le script en local et l'exécuter, ou lancer directement `zx https://raw.githubusercontent.com/SocialGouv/sre-scripts/master/src/kdb/kdb.mjs`

Pour un utilisateur non admin, on peut ajouter un argument qui permettra de filtrer les namespaces, par ex :

```
zx  https://raw.githubusercontent.com/SocialGouv/sre-scripts/master/src/kdb/kdb.mjs domifa
```
