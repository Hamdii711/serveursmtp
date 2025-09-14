# Guide de Gestion du VPS et de l'API d'envoi d'e-mails

Ce document centralise toutes les commandes utiles pour gérer votre serveur et votre application.

---

## 1. Connexion au Serveur

Pour vous connecter à votre VPS, ouvrez un terminal sur votre ordinateur et utilisez la commande SSH. Remplacez `ubuntu` et `VOTRE_ADRESSE_IP` par vos informations.

```bash
ssh ubuntu@VOTRE_ADRESSE_IP
```

---

## 2. Gérer l'Application API avec PM2

Toutes ces commandes doivent être lancées depuis le dossier de l'application (`cd ~/serveursmtp`).

-   **Démarrer l'application :**
    ```bash
    pm2 start dist/index.js --name email-api
    ```

-   **Arrêter l'application :**
    ```bash
    pm2 stop email-api
    ```

-   **Redémarrer l'application :** (Utile après une petite modification de configuration)
    ```bash
    pm2 restart email-api
    ```

-   **Voir les logs en direct :** (Très utile pour le débogage)
    ```bash
    pm2 logs email-api
    ```

-   **Voir le statut de l'application :**
    ```bash
    pm2 status
    ```

---

## 3. Mettre à jour le Code de l'Application depuis GitHub

C'est la procédure complète pour déployer une nouvelle version du code.

```bash
# Aller dans le bon dossier
cd ~/serveursmtp

# 1. Télécharger les dernières modifications
git pull

# 2. Mettre à jour les dépendances (si nécessaire)
npm install

# 3. Recompiler le code TypeScript
npm run build

# 4. Redémarrer l'application avec PM2
pm2 restart email-api
```

---

## 4. Gérer les Services du Serveur

-   **Redémarrer le serveur d'e-mails (Postfix) :**
    ```bash
    sudo systemctl restart postfix
    ```

-   **Redémarrer le service de signature (OpenDKIM) :**
    ```bash
    sudo systemctl restart opendkim
    ```

-   **Voir le statut d'un service :** (Remplacez `postfix` par `opendkim` si besoin)
    ```bash
    sudo systemctl status postfix
    ```

---

## 5. Maintenance de Base du Serveur

-   **Mettre à jour tous les logiciels du serveur :** (À faire régulièrement, ex: une fois par semaine)
    ```bash
    sudo apt update && sudo apt upgrade -y
    ```

-   **Redémarrer le serveur VPS :** (Nécessaire après certaines mises à jour système)
    ```bash
    sudo reboot
    ```

---

## 6. Emplacements des Fichiers Importants

-   **Code de l'application :** `/home/ubuntu/serveursmtp/`
-   **Fichier de configuration de l'API (`.env`) :** `/home/ubuntu/serveursmtp/.env`
-   **Base de données de l'API :** `/home/ubuntu/serveursmtp/database.sqlite`
-   **Configuration Postfix :** `/etc/postfix/main.cf`
-   **Configuration OpenDKIM :** `/etc/opendkim.conf`
-   **Clés DKIM :** `/etc/opendkim/keys/`
-   **Logs du serveur mail :** `/var/log/mail.log`

---
---

## 7. Documentation de l'API d'envoi d'e-mails

Ce document décrit comment utiliser l'API pour envoyer des e-mails.

### Endpoint

```
POST /api/send
```

### URL Complète

`http://VOTRE_ADRESSE_IP:3000/api/send`

### En-têtes (Headers)

| Clé             | Valeur              | Description                                                              |
| --------------- | ------------------- | ------------------------------------------------------------------------ |
| `Content-Type`  | `application/json`  | **Requis.** Indique que le corps de la requête est au format JSON.         |
| `x-api-key`     | `string`            | **Requis.** Votre clé d'API secrète, générée depuis le panneau d'administration. |

### Corps de la requête (Body)

Le corps de la requête doit être un objet JSON contenant les champs suivants :

| Champ     | Type     | Description                                                                                                | Requis |
| --------- | -------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| `from`    | `string` | L'adresse e-mail de l'expéditeur. **Le domaine de cette adresse doit avoir été ajouté et vérifié** dans le panneau d'administration pour le client associé à la clé d'API. | Oui    |
| `to`      | `string` | L'adresse e-mail du destinataire.                                                                          | Oui    |
| `subject` | `string` | Le sujet de l'e-mail.                                                                                      | Oui    |
| `html`    | `string` | Le contenu de l'e-mail au format HTML.                                                                     | Oui    |

### Exemple de Requête (`curl`)

```bash
curl -X POST \
  http://VOTRE_ADRESSE_IP:3000/api/send \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: VOTRE_CLE_API' \
  -d '{
    "from": "contact@domaine-verifie.com",
    "to": "destinataire@email.com",
    "subject": "Sujet de votre e-mail",
    "html": "<h1>Titre</h1><p>Ceci est un e-mail de test.</p>"
  }'
```

### Réponses

#### Succès

-   **Code :** `200 OK`
-   **Corps :**
    ```json
    {
      "message": "Email sent successfully"
    }
    ```

#### Erreurs

-   **Code :** `400 Bad Request`
-   **Code :** `401 Unauthorized`
-   **Code :** `403 Forbidden`
-   **Code :** `500 Internal Server Error`
