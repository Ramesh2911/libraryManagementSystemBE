import path from 'path';
import fs from 'fs';
import YAML from 'yaml';
import swaggerUi, { JsonObject, SwaggerUiOptions } from 'swagger-ui-express';

const specPath = path.join(__dirname, '..', 'openapi.yaml');

function loadSpec(): JsonObject {
  const raw = fs.readFileSync(specPath, 'utf8');
  return YAML.parse(raw) as JsonObject;
}

export const openapiSpec = loadSpec();

export const swaggerUiOptions: SwaggerUiOptions = {
  customSiteTitle: 'SmartLibrary API',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    deepLinking: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: -1,
    persistAuthorization: true,
  },
};

export { swaggerUi };
