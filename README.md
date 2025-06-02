[![smithery badge](https://smithery.ai/badge/@lucygoodchild/mcp-national-rail)](https://smithery.ai/server/@lucygoodchild/mcp-national-rail)

# mcp-national-rail

A Model Context Protocol (MCP) server to retrieve train schedules from National Rail.

## Overview

This project implements a server using the Model Context Protocol (MCP) that allows AI agents to retrieve train information on National Rail trains using the Realtime Trains API. 

It provides tools for:
- get_live_departures
- get_live_arrivals
- get_departures_by_date
- get_arrivals_by_date

## Installation

Real Time Trains API account can be created from here: https://api.rtt.io/ 

You will need to note down your API Auth credentials 

### Installing via Smithery

To install mcp-national-rail for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@lucygoodchild/mcp-national-rail):

```bash
npx -y @smithery/cli install @lucygoodchild/mcp-national-rail --client claude
```

### Manual Installation for Claude Desktop

#### Prerequisites
- Node.js

#### Setup

1. Clone this repository
2. Install dependencies
```bash
npm install
```
3. Build and start the project
```bash
npm run build
npm run start
```
4. Add the following to your MCP client configuration (~/Library/Application Support/Claude/claude_desktop_config.json):
```bash
{
  "mcpServers": {
    "mcp-national-rail": {
      "command": "node",
      "args": ["/path/to/mcp-national-rail/dist/index.js"],
      "env": {
        "RTT_API_USERNAME": "your_rtt_api_username",
        "RTT_API_PASSWORD": "your_rtt_api_password"
      }
    }
  }
}
```
Make sure to replace "/path/to/mcp-national-rail/dist/index.js" with the actual path and add your RTT API username and password which can be created from here: https://api.rtt.io/

5. Restart Claude

### Development
- Create .env file based on the example file
```bash
RTT_API_USERNAME=your_rtt_api_username
RTT_API_PASSWORD=your_rtt_api_password
```

Run the inspector with the following command:
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```
