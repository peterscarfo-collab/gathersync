import { config } from 'dotenv';
config();
import { db } from './server/db.ts';
// This is not easy to run in the sandbox since it requires the db connection.
