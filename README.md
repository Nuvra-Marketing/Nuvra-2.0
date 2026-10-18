# Nuvra — prévisualisation locale

Reconstitution des pages publiques de https://nuvra-os.whop.site à partir de leurs contenus accessibles. La mise en page est recréée ; le code source, les données privées et le builder authentifié n’ont pas été récupérés.

## Lancer

```sh
npm install
npm run dev
```

- `/` : accueil
- `/academy` : programme public de l’Académie
- `/app` : **démo locale**, édition, sauvegarde navigateur et export HTML autonome

Les liens de paiement sont les liens Whop publics existants et ouvrent un vrai checkout. Aucune authentification ou donnée client n’est migrée. Pour une migration complète, fournir le code source et configurer côté serveur l’authentification Whop et les accès aux données. Ne pas partager de secrets dans le chat.

`npm run build` génère la version de production.
