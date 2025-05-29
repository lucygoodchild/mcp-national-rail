import { Config } from '../types.js';
import './setup.js';

const config: Config = {
    RTT_API_USERNAME: process.env.RTT_API_USERNAME ?? '',
    RTT_API_PASSWORD: process.env.RTT_API_PASSWORD ?? '',
};

export default config;