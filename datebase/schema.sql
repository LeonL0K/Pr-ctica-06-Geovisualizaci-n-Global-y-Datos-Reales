CREATE DATABASE IF NOT EXISTS practica06_geo;
USE practica06_geo;

CREATE TABLE api_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  api VARCHAR(50) NOT NULL,
  coord_key VARCHAR(100) NOT NULL,
  response_data JSON NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expira_en TIMESTAMP NOT NULL,
  UNIQUE KEY idx_api_coord (api, coord_key)
);