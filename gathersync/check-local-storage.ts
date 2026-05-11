import * as fs from 'fs';
// We can't access AsyncStorage from node.js easily unless we read the sqlite file or whatever it uses.
// But wait, the user is running the app on their device or simulator.
