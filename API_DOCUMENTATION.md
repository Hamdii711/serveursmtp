# Documentation de l'API d'envoi d'e-mails

Ce document décrit comment utiliser l'API pour envoyer des e-mails.

---

## Envoyer un e-mail

### Endpoint

```
POST /api/send
```

### URL Complète

`http://VOTRE_ADRESSE_IP:3000/api/send`

---

### En-têtes (Headers)

| Clé             | Valeur              | Description                                                              |
| --------------- | ------------------- | ------------------------------------------------------------------------ |
| `Content-Type`  | `application/json`  | **Requis.** Indique que le corps de la requête est au format JSON.         |
| `x-api-key`     | `string`            | **Requis.** Votre clé d'API secrète, générée depuis le panneau d'administration. |

---

### Corps de la requête (Body)

Le corps de la requête doit être un objet JSON contenant les champs suivants :

| Champ     | Type     | Description                                                                                                | Requis |
| --------- | -------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| `from`    | `string` | L'adresse e-mail de l'expéditeur. **Le domaine de cette adresse doit avoir été ajouté et vérifié** dans le panneau d'administration pour le client associé à la clé d'API. | Oui    |
| `to`      | `string` | L'adresse e-mail du destinataire.                                                                          | Oui    |
| `subject` | `string` | Le sujet de l'e-mail.                                                                                      | Oui    |
| `html`    | `string` | Le contenu de l'e-mail au format HTML.                                                                     | Oui    |

---

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

---

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
    -   **Raison :** Un ou plusieurs champs requis sont manquants dans le corps de la requête.
    -   **Corps :**
        ```json
        {
          "error": "Missing required fields: from, to, subject, html"
        }
        ```

-   **Code :** `401 Unauthorized`
    -   **Raison :** La clé d'API est manquante ou invalide.
    -   **Corps :**
        ```json
        {
          "error": "Unauthorized: Invalid API key"
        }
        ```

-   **Code :** `403 Forbidden`
    -   **Raison :** Le domaine de l'expéditeur (`from`) n'a pas été vérifié pour ce client.
    -   **Corps :**
        ```json
        {
          "error": "Domain <exemple.com> is not verified for this client."
        }
        ```

-   **Code :** `500 Internal Server Error`
    -   **Raison :** Le serveur a rencontré une erreur en essayant d'envoyer l'e-mail (problème de connexion à Postfix, etc.).
    -   **Corps :**
        ```json
        {
          "error": "Failed to send email"
        }
