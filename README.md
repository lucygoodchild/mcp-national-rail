[![smithery badge](https://smithery.ai/badge/@lucygoodchild/mcp-national-rail)](https://smithery.ai/server/@lucygoodchild/mcp-national-rail)

# mcp-national-rail

A Model Context Protocol (MCP) server for Network Rail service and rolling-stock data from the Realtime Trains API.

## API

This server uses the Realtime Trains API 2.0 Network Rail endpoints:

- `GET /gb-nr/location`
- `GET /gb-nr/service`
- `GET /gb-nr/allocations/by-service`
- `GET /gb-nr/allocations/by-class`

Create an account and obtain credentials from the [Realtime Trains API portal](https://api-portal.rtt.io/).

## MCP tools

- `get_live_departures`: Query a station location lineup, optionally filtered by destination.
- `get_live_arrivals`: Query a station location lineup, optionally filtered by origin.
- `get_departures_by_date`: Query departures in an ISO 8601 time window.
- `get_arrivals_by_date`: Query arrivals in an ISO 8601 time window.
- `get_network_rail_service`: Retrieve a service's detailed locations and, when authorized, allocation data.
- `get_allocations_by_service`: List allocations by TOC and departure date.
- `get_allocations_by_class`: List allocations by rolling-stock class and departure date.

Station values may be short codes such as `WAT` or long Network Rail location codes. Time windows use ISO 8601 values, for example `2026-09-11T08:10:00`. The API supports either `timeTo` or `timeWindow`; the maximum window is 23 hours 59 minutes.

Service queries accept either `uniqueIdentity`, or both `identity` and `departureDate`. Allocation tools require `departureDate` in `YYYY-MM-DD` format and the relevant TOC or rolling-stock class.

## Authentication and entitlements

Set `RTT_API_TOKEN` to a Realtime Trains access token. Tokens are sent only from this server as a Bearer token. The token must have the relevant entitlements for the data requested:

- `allowDetailed` enables detailed service and location data.
- `allowAllocations` enables allocation data on service and location queries.
- `allowFullAllocationListing` or `allowFullAllocationListingPassenger` enables the allocation listing tools.
- `allowAllocationComponents` enables individual vehicle component data where available.

Some allocation data is restricted by train operator. A valid token can therefore still receive `401` for an allocation request.

Optionally set `RTT_API_VERSION` to pin requests to a specific API version, such as `2026-04-09`. If it is omitted, the API's latest version is used.

## Installation

### Claude Desktop extension (MCPB)

This project can be packaged as an MCP Bundle (`.mcpb`). The bundle contains the compiled Node.js server and its dependencies, so Claude Desktop can install it without an absolute project path or a manual `mcpServers` entry.

Build the bundle:

```bash
npm install
npm run mcpb:pack
```

The output is `dist/national-rail.mcpb`. Open that file with Claude Desktop and enter your Realtime Trains API token when prompted. The token is marked sensitive in the bundle manifest and is passed to the server only as an environment variable.

The MCPB CLI can also be installed globally if you prefer not to use `npx`:

```bash
npm install --global @anthropic-ai/mcpb
mcpb validate manifest.json
mcpb pack . dist/national-rail.mcpb
```

The existing manual configuration method remains useful for development and debugging.

### Installing via Smithery

Install automatically for Claude Desktop via [Smithery](https://smithery.ai/server/@lucygoodchild/mcp-national-rail):

```bash
npx -y @smithery/cli install @lucygoodchild/mcp-national-rail --client claude
```

### Manual installation

#### Prerequisites

- Node.js
- A Realtime Trains API token

#### Setup

1. Clone this repository.
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the project root:

```dotenv
RTT_API_TOKEN=your_rtt_api_token
# RTT_API_VERSION=2026-04-09
```

4. Build and start the server:

```bash
npm run build
npm run start
```

5. Add the server to your MCP client configuration. For Claude Desktop:

```json
{
  "mcpServers": {
    "mcp-national-rail": {
      "command": "node",
      "args": ["/path/to/mcp-national-rail/dist/index.js"],
      "env": {
        "RTT_API_TOKEN": "your_rtt_api_token"
      }
    }
  }
}
```

Replace the path and token with your local values, then restart the MCP client.

## Development

Run the server directly with `tsx`:

```bash
npm run dev
```

Run the MCP Inspector against the compiled server:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

The server also reports API errors, rate-limit retry information, and missing credentials through MCP tool errors.