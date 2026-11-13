// Loads backend/.env into process.env. Must be imported before anything reads the config.
import { config as loadEnv } from 'dotenv';

loadEnv();
