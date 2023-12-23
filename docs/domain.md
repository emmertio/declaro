# Domain

A standardized schema for defining the domain of a project.

## Define Data Structures

### Domain Entities

Data entities should be defined in terms of objects and fields.
Objects can represent database tables, data graph types, or documents.
Fields can represent database columns, API response properties, or document attributes,
but are not perscriptive of the underlying implementation.

Here is a sample schema for a todo application using the OpenAPI specification 3.1.0. We will extend this definition
to capture all of the business domain information for our todo app.

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Todo App",
    "version": "1.0.0"
  },
  "paths": {
    ...
  },
  "components": {
    "schemas": {
      "Project": {
        "type": "object",
        "properties": {
          "uuid": {
            "type": "string",
            "format": "uuid"
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "todos": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Todo"
            }
          }
        }
      },
      "Todo": {
        "type": "object",
        "properties": {
          "uuid": {
            "type": "string",
            "format": "uuid"
          },
          "title": {
            "type": "string"
          },
          "completed": {
            "type": "boolean"
          }
        }
      }
    }
  }
}
```

You could auto-generate some limited application assets from even this basic spec, such as GraphQL entities,
Typescript definitions, or maybe even database tables. However, this is not enough information to fully capture the
business needs behind this data. For example, we don't know if the email field is required, or if the phone field is
to be formatted in a specific way. We also don't know if the name field is a first name, last name, or full name.

Let's add some more specific modifiers to our schema so that we could automatically generate a database from it. We
need to add modifiers to explain which fields are foreign keys and how objects are related.

While we're at it, let's add some validation rules to our schema. This will allow us to write code to validate an
arbitrary json object against our schema.

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Todo App",
    "version": "1.0.0"
  },
  "paths": {
    ...
  },
  "components": {
    "schemas": {
      "Project": {
        "type": "object",
        "properties": {
          "uuid": {
            "type": "string",
            "format": "uuid",
            "required": true,
            "unique": true,
            "primaryKey": true
          },
          "name": {
            "type": "string",
            "required": true,
            "unique": true,
            "minLength": 3,
            "maxLength": 255
          },
          "description": {
            "type": "string",
            "maxLength": 1024
          },
          "todos": {
            "type": "array",
            "format": "one-to-many",
            "inverse": "project",
            "maxItems": 100,
            "items": {
              "$ref": "#/components/schemas/Todo"
            }
          }
        }
      },
      "Todo": {
        "type": "object",
        "properties": {
          "uuid": {
            "type": "string",
            "format": "uuid",
            "required": true,
            "unique": true,
            "primaryKey": true
          },
          "title": {
            "type": "string",
            "required": true,
            "minLength": 3,
            "maxLength": 255
          },
          "completed": {
            "type": "boolean"
          },
          "project": {
            "$ref": "#/components/schemas/Project",
            "format": "many-to-one"
          }
        }
      }
    }
  }
}
```

We could now theoretically generate database tables from this schema. We could also validate data against this
schema from a service or even optimistically on the client.

However, an application may need to specify custom validation rules that should be reused throughout the application
schema. For example, let's use a 3rd party service to validate whether or not project titles contain objectionable
material, such as profanity. The integration is not a domain concern, but which fields need to use that integration
is. We can mark that by using a custom validation directive. We need to explain at an application level what each
custom validator does, so that our domain is well documented for users and services alike.

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Todo App",
    "version": "1.0.0"
  },
  "paths": {
    ...
  },
  "components": {
    "schemas": {
      "Project": {
        "type": "object",
        "properties": {
          "uuid": {
            "type": "string",
            "format": "uuid",
            "required": true,
            "unique": true,
            "primaryKey": true
          },
          "name": {
            "type": "string",
            "required": true,
            "unique": true,
            "minLength": 3,
            "maxLength": 255,
            "validate": [
              {
                "name": "profanity",
                "message": "Project name contains objectionable material."
              }
            ]
          },
          "description": {
            "type": "string",
            "maxLength": 1024
          },
          "todos": {
            "type": "array",
            "format": "one-to-many",
            "inverse": "project",
            "maxItems": 100,
            "items": {
              "$ref": "#/components/schemas/Todo"
            }
          }
        }
      },
      "Todo": {
        "type": "object",
        "properties": {
          "uuid": {
            "type": "string",
            "format": "uuid",
            "required": true,
            "unique": true,
            "primaryKey": true
          },
          "title": {
            "type": "string",
            "required": true,
            "minLength": 3,
            "maxLength": 255
          },
          "completed": {
            "type": "boolean"
          },
          "project": {
            "$ref": "#/components/schemas/Project",
            "format": "many-to-one"
          }
        }
      }
    }
  },
  "validators": {
    "profanity": {
      "name": "Profanity",
      "description": "Validates that a string does not contain objectionable material.",
      "type": "string",
      "validate": "profanity"
    }
  }
}
```

If we were using a translation framework, we would need to be less perscriptive about the validation error message.
We could instead provide a translation key that would be used to look up the error message using a translation service.

Example:

```json
{
    "name": "profanity",
    "messageKey": "validation.profanity"
}
```

### Advanced Domain Entity Definition

#### Domain Entity Inheritance

Domain entities can inherit from other domain entities. This allows for the reuse of common properties and validation

Here is an example of a domain schema written in OpenAPI spec illustrating entity inheritance in the classic example
of an animal tracker:

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Animal Tracker",
    "version": "1.0.0"
  },
  "paths": {
    ...
  },
  "components": {
    "schemas": {
      "Animal": {
        "type": "object",
        "properties": {
          "uuid": {
            "type": "string",
            "format": "uuid",
            "required": true,
            "unique": true,
            "primaryKey": true
          },
          "name": {
            "type": "string",
            "required": true,
            "unique": true,
            "minLength": 3,
            "maxLength": 255
          },
          "description": {
            "type": "string",
            "maxLength": 1024
          },
          "tags": {
            "type": "array",
            "format": "one-to-many",
            "inverse": "animal",
            "maxItems": 100,
            "items": {
              "$ref": "#/components/schemas/Tag"
            }
          }
        }
      },
      "Tag": {
        "type": "object",
        "properties": {
          "uuid": {
            "type": "string",
            "format": "uuid",
            "required": true,
            "unique": true,
            "primaryKey": true
          },
          "name": {
            "type": "string",
            "required": true,
            "unique": true,
            "minLength": 3,
            "maxLength": 255
          },
          "description": {
            "type": "string",
            "maxLength": 1024
          },
          "animal": {
            "$ref": "#/components/schemas/Animal",
            "format": "many-to-one"
          }
        }
      },
      "Dog": {
        "allOf": [
          {
            "$ref": "#/components/schemas/Animal"
          },
          {
            "type": "object",
            "properties": {
              "breed": {
                "type": "string",
                "required": true,
                "minLength": 3,
                "maxLength": 255
              },
              "color": {
                "type": "string",
                "required": true,
                "minLength": 3,
                "maxLength": 255
              }
            }
          }
        ]
      }
    }
  }
}
```

