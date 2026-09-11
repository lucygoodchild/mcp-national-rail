import { Config } from '../types.js';
import './setup.js';

const config: Config = {
    RTT_API_TOKEN: process.env.RTT_API_TOKEN ?? '',
    RTT_API_VERSION: process.env.RTT_API_VERSION,
};

export default config;