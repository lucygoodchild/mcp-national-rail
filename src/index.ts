import './config/setup.js'
import config from './config/index.js';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { ApiResponse, LocationContainer } from "./types.js";

class NationalRailMCPServer {
  private server: Server;
  private baseUrl = "https://api.rtt.io/api/v1";
  private apiUsername: string;
  private apiPassword: string;

  constructor() {
    this.server = new Server({
      name: "national-rail-mcp-server",
      version: "0.1.0",
      capabilities: {
        tools: {},
      },
    });

    // Get API credentials from environment variables
    this.apiUsername = config.RTT_API_USERNAME || "";
    this.apiPassword = config.RTT_API_PASSWORD || "";

    if (!this.apiUsername || !this.apiPassword) {
      console.error("Warning: RTT_API_USERNAME and RTT_API_PASSWORD environment variables not set");
    }

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_live_departures",
            description: "Get live departure information for a station",
            inputSchema: {
              type: "object",
              properties: {
                station: {
                  type: "string",
                  description: "Station CRS code (3 letters) or TIPLOC",
                },
                toStation: {
                  type: "string",
                  description: "Optional destination station CRS code or TIPLOC to filter results",
                },
              },
              required: ["station"],
            },
          },
          {
            name: "get_live_arrivals",
            description: "Get live arrival information for a station",
            inputSchema: {
              type: "object",
              properties: {
                station: {
                  type: "string",
                  description: "Station CRS code (3 letters) or TIPLOC",
                },
                fromStation: {
                  type: "string",
                  description: "Optional origin station CRS code or TIPLOC to filter results",
                },
              },
              required: ["station"],
            },
          },
          {
            name: "get_departures_by_date",
            description: "Get departure information for a specific date",
            inputSchema: {
              type: "object",
              properties: {
                station: {
                  type: "string",
                  description: "Station CRS code (3 letters) or TIPLOC",
                },
                year: {
                  type: "number",
                  description: "Year (e.g., 2024)",
                },
                month: {
                  type: "number",
                  description: "Month (1-12)",
                },
                day: {
                  type: "number",
                  description: "Day of month (1-31)",
                },
                time: {
                  type: "string",
                  description: "Optional time in HHMM format (e.g., '0810' or '2315')",
                },
                toStation: {
                  type: "string",
                  description: "Optional destination station CRS code or TIPLOC to filter results",
                },
              },
              required: ["station", "year", "month", "day"],
            },
          },
          {
            name: "get_arrivals_by_date",
            description: "Get arrival information for a specific date",
            inputSchema: {
              type: "object",
              properties: {
                station: {
                  type: "string",
                  description: "Station CRS code (3 letters) or TIPLOC",
                },
                year: {
                  type: "number",
                  description: "Year (e.g., 2024)",
                },
                month: {
                  type: "number",
                  description: "Month (1-12)",
                },
                day: {
                  type: "number",
                  description: "Day of month (1-31)",
                },
                time: {
                  type: "string",
                  description: "Optional time in HHMM format (e.g., '0810' or '2315')",
                },
                fromStation: {
                  type: "string",
                  description: "Optional origin station CRS code or TIPLOC to filter results",
                },
              },
              required: ["station", "year", "month", "day"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_live_departures":
            return await this.getLiveDepartures(args);
          case "get_live_arrivals":
            return await this.getLiveArrivals(args);
          case "get_departures_by_date":
            return await this.getDeparturesByDate(args);
          case "get_arrivals_by_date":
            return await this.getArrivalsByDate(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async makeApiRequest(endpoint: string): Promise<ApiResponse> {
    if (!this.apiUsername || !this.apiPassword) {
      throw new Error("API credentials not configured. Set RTT_API_USERNAME and RTT_API_PASSWORD environment variables.");
    }

    const url = `${this.baseUrl}${endpoint}`;
    const auth = Buffer.from(`${this.apiUsername}:${this.apiPassword}`).toString('base64');
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json() as ApiResponse;
  }

 private formatServiceInfo(service: LocationContainer): string {
    const location = service.locationDetail;
    let info = `Service ${service.serviceUid} (${service.atocName})\n`;
    info += `  Train: ${service.trainIdentity}\n`;
    info += `  Type: ${service.serviceType} (${service.isPassenger ? 'Passenger' : 'Freight'})\n`;
    
    if (location.origin && location.origin.length > 0) {
      info += `  From: ${location.origin.map(o => o.description).join(', ')}\n`;
    }
    if (location.destination && location.destination.length > 0) {
      info += `  To: ${location.destination.map(d => d.description).join(', ')}\n`;
    }

    if (location.gbttBookedDeparture) {
      info += `  Scheduled Departure: ${location.gbttBookedDeparture}\n`;
    }
    if (location.realtimeDeparture) {
      info += `  ${location.realtimeDepartureActual ? 'Actual' : 'Expected'} Departure: ${location.realtimeDeparture}\n`;
      if (location.realtimeGbttDepartureLateness !== undefined) {
        info += `  Delay: ${location.realtimeGbttDepartureLateness > 0 ? '+' : ''}${location.realtimeGbttDepartureLateness} minutes\n`;
      }
    }

    if (location.gbttBookedArrival) {
      info += `  Scheduled Arrival: ${location.gbttBookedArrival}\n`;
    }
    if (location.realtimeArrival) {
      info += `  ${location.realtimeArrivalActual ? 'Actual' : 'Expected'} Arrival: ${location.realtimeArrival}\n`;
      if (location.realtimeGbttArrivalLateness !== undefined) {
        info += `  Delay: ${location.realtimeGbttArrivalLateness > 0 ? '+' : ''}${location.realtimeGbttArrivalLateness} minutes\n`;
      }
    }

    if (location.platform) {
      info += `  Platform: ${location.platform}${location.platformConfirmed ? ' (Confirmed)' : ''}${location.platformChanged ? ' (Changed)' : ''}\n`;
    }

    if (service.countdownMinutes !== undefined) {
      info += `  Due in: ${service.countdownMinutes} minutes\n`;
    }

    if (location.cancelReasonShortText) {
      info += `  Cancellation: ${location.cancelReasonShortText}\n`;
    }

    if (location.displayAs) {
      info += `  Status: ${location.displayAs}\n`;
    }

    return info;
}

  private async getLiveDepartures(args: any) {
    const { station, toStation } = args;
    let endpoint = `/json/search/${station}`;
    
    if (toStation) {
      endpoint += `/to/${toStation}`;
    }

    const data = await this.makeApiRequest(endpoint);
    
    let result = `Live departures for ${data.location.name} (${data.location.crs || data.location.tiploc})\n\n`;
    
    if (data.filter) {
      if (data.filter.destination) {
        result += `Filtered to: ${data.filter.destination.name}\n\n`;
      }
    }
    
     if (!data.services || data.services.length === 0) {
        result += "No services found.\n";
    } else {
        data.services.forEach(service => {
            result += this.formatServiceInfo(service) + "\n";
        });
    }

    return {
      content: [
        {
          type: "text",
          text: result.trim()
        },
      ],
    };
  }

  private async getLiveArrivals(args: any) {
    const { station, fromStation } = args;
    let endpoint = `/json/search/${station}/arrivals`;
    
    if (fromStation) {
      endpoint = `/json/search/${station}/from/${fromStation}/arrivals`;
    }

    const data = await this.makeApiRequest(endpoint);
    
    let result = `Live arrivals for ${data.location.name} (${data.location.crs || data.location.tiploc})\n\n`;
    
    if (data.filter) {
      if (data.filter?.origin?.name) {
        result += `Filtered from: ${data.filter?.origin?.name}\n\n`;
      }
    }

     if (!data.services || data.services.length === 0) {
        result += "No services found.\n";
    } else {
        data.services.forEach(service => {
            result += this.formatServiceInfo(service) + "\n";
        });
    }

    return {
      content: [
        {
          type: "text",
          text: result.trim(),
        },
      ],
    };
  }

  private async getDeparturesByDate(args: any) {
    const { station, year, month, day, time, toStation } = args;
    let endpoint = `/json/search/${station}`;
    
    if (toStation) {
      endpoint += `/to/${toStation}`;
    }
    
    const paddedMonth = month.toString().padStart(2, '0');
    const paddedDay = day.toString().padStart(2, '0');
    endpoint += `/${year}/${paddedMonth}/${paddedDay}`;
    
    if (time) {
      endpoint += `/${time}`;
    }

    const data = await this.makeApiRequest(endpoint);
    
    let result = `Departures for ${data.location.name} (${data.location.crs || data.location.tiploc}) on ${year}-${paddedMonth}-${paddedDay}`;
    if (time) {
      result += ` at ${time}`;
    }
    result += '\n\n';
    
    if (data.filter) {
      if (data.filter.destination) {
        result += `Filtered to: ${data.filter.destination.name}\n\n`;
      }
    }

     if (!data.services || data.services.length === 0) {
        result += "No services found.\n";
    } else {
        data.services.forEach(service => {
            result += this.formatServiceInfo(service) + "\n";
        });
    }

    return {
      content: [
        {
          type: "text",
          text: result.trim(),
        },
      ],
    };
  }

  private async getArrivalsByDate(args: any) {
    const { station, year, month, day, time, fromStation } = args;
    let endpoint = `/json/search/${station}`;
    
    if (fromStation) {
      endpoint = `/json/search/${station}/from/${fromStation}`;
    }
    
    const paddedMonth = month.toString().padStart(2, '0');
    const paddedDay = day.toString().padStart(2, '0');
    endpoint += `/${year}/${paddedMonth}/${paddedDay}`;
    
    if (time) {
      endpoint += `/${time}`;
    }
    
    endpoint += '/arrivals';

    const data = await this.makeApiRequest(endpoint);
    
    let result = `Arrivals for ${data.location.name} (${data.location.crs || data.location.tiploc}) on ${year}-${paddedMonth}-${paddedDay}`;
    if (time) {
      result += ` at ${time}`;
    }
    result += '\n\n';
    
     if (data.filter) {
      if (data.filter?.origin?.name) {
        result += `Filtered from: ${data.filter?.origin?.name}\n\n`;
      }
    }

     if (!data.services || data.services.length === 0) {
        result += "No services found.\n";
    } else {
        data.services.forEach(service => {
            result += this.formatServiceInfo(service) + "\n";
        });
    }

    return {
      content: [
        {
          type: "text",
          text: result.trim(),
        },
      ],
    };
  }

  async run() {
    try {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("National Rail MCP server running on stdio");
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
  }
}

const server = new NationalRailMCPServer();
server.run().catch(console.error);