import './config/setup.js';
import config from './config/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Allocation, AllocationsByClassResponse, AllocationsByServiceResponse, GeographicLocation, IndividualTemporalData, LocationPair, LocationResponse, NetworkRailLocationLineUpObject, NetworkRailServiceLocation, ServiceResponse } from './types.js';

type ToolArgs = Record<string, unknown>;
type QueryParams = Record<string, string | number | boolean | undefined>;

process.on('uncaughtException', (error) => {
    console.error('National Rail MCP uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('National Rail MCP unhandled rejection:', reason);
});

class NationalRailMCPServer {
    private server: Server;
    private baseUrl = 'https://data.rtt.io';
    private bearerToken: string;

    constructor() {
        this.server = new Server(
            { name: 'national-rail-mcp-server', version: '0.2.4' },
            { capabilities: { tools: {} } },
        );
        this.bearerToken = config.RTT_API_TOKEN;
        if (!this.bearerToken) console.error('Warning: RTT_API_TOKEN environment variable not set');
        this.setupToolHandlers();
    }

    private setupToolHandlers() {
        const locationProperties = {
            station: { type: 'string', description: 'Station short or long code' },
            timeFrom: { type: 'string', description: 'Optional ISO 8601 start time' },
            timeTo: { type: 'string', description: 'Optional ISO 8601 end time' },
            timeWindow: { type: 'number', description: 'Optional window length in minutes' },
            detailed: { type: 'boolean', description: 'Request detailed data when authorized' },
        };
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                { name: 'get_live_departures', description: 'Get live Network Rail departures for a station', inputSchema: { type: 'object', properties: { ...locationProperties, toStation: { type: 'string', description: 'Optional destination short or long code' } }, required: ['station'] } },
                { name: 'get_live_arrivals', description: 'Get live Network Rail arrivals for a station', inputSchema: { type: 'object', properties: { ...locationProperties, fromStation: { type: 'string', description: 'Optional origin short or long code' } }, required: ['station'] } },
                { name: 'get_departures_by_date', description: 'Get Network Rail departures in an ISO 8601 time window', inputSchema: { type: 'object', properties: { ...locationProperties, toStation: { type: 'string', description: 'Optional destination short or long code' } }, required: ['station', 'timeFrom'] } },
                { name: 'get_arrivals_by_date', description: 'Get Network Rail arrivals in an ISO 8601 time window', inputSchema: { type: 'object', properties: { ...locationProperties, fromStation: { type: 'string', description: 'Optional origin short or long code' } }, required: ['station', 'timeFrom'] } },
                { name: 'get_network_rail_service', description: 'Get detailed Network Rail data for a service', inputSchema: { type: 'object', properties: { uniqueIdentity: { type: 'string', description: 'Service unique identity' }, identity: { type: 'string', description: 'Train identity, such as 1L40' }, departureDate: { type: 'string', description: 'Departure date in YYYY-MM-DD format' }, detailed: { type: 'boolean', description: 'Request detailed data when authorized' } } } },
                { name: 'get_allocations_by_service', description: 'List rolling stock allocations by TOC and departure date', inputSchema: { type: 'object', properties: { departureDate: { type: 'string', description: 'Departure date in YYYY-MM-DD format' }, toc: { type: 'string', description: 'Train operating company code' } }, required: ['departureDate', 'toc'] } },
                { name: 'get_allocations_by_class', description: 'List rolling stock allocations by class and departure date', inputSchema: { type: 'object', properties: { departureDate: { type: 'string', description: 'Departure date in YYYY-MM-DD format' }, class: { type: 'string', description: 'Rolling stock class, such as 444' } }, required: ['departureDate', 'class'] } },
            ],
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args = {} } = request.params;
            try {
                const toolArgs = args as ToolArgs;
                switch (name) {
                    case 'get_live_departures': return await this.getLocation(toolArgs, 'departures');
                    case 'get_live_arrivals': return await this.getLocation(toolArgs, 'arrivals');
                    case 'get_departures_by_date': return await this.getLocation(toolArgs, 'departures');
                    case 'get_arrivals_by_date': return await this.getLocation(toolArgs, 'arrivals');
                    case 'get_network_rail_service': return await this.getNetworkRailService(toolArgs);
                    case 'get_allocations_by_service': return await this.getAllocationsByService(toolArgs);
                    case 'get_allocations_by_class': return await this.getAllocationsByClass(toolArgs);
                    default: throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            } catch (error) {
                throw new McpError(ErrorCode.InternalError, `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }

    private async makeApiRequest<T>(path: string, params: QueryParams = {}): Promise<T | null> {
        if (!this.bearerToken) throw new Error('API credentials not configured. Set RTT_API_TOKEN environment variable.');
        const url = new URL(`${this.baseUrl}${path}`);
        Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') url.searchParams.set(key, String(value)); });
        const headers: Record<string, string> = { Authorization: `Bearer ${this.bearerToken}`, Accept: 'application/json' };
        if (config.RTT_API_VERSION) headers.Version = config.RTT_API_VERSION;
        const response = await fetch(url, { headers });
        if (response.status === 204) return null;
        const body = await response.text();
        if (!response.ok) {
            const retryAfter = response.headers.get('retry-after');
            let detail = body;
            try {
                const errorBody = JSON.parse(body) as { error?: string; message?: string };
                detail = errorBody.error ?? errorBody.message ?? body;
            } catch {
                // Keep the raw response body when the API does not return JSON.
            }
            throw new Error(`API request failed: ${response.status} ${response.statusText}: ${detail}.${retryAfter ? ` Retry after ${retryAfter} seconds.` : ''}`);
        }
        return body ? JSON.parse(body) as T : null;
    }

    private value(args: ToolArgs, name: string): string | number | boolean | undefined {
        const value = args[name];
        return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined;
    }

    private requiredString(args: ToolArgs, name: string): string {
        const value = this.value(args, name);
        if (typeof value !== 'string' || !value) throw new Error(`${name} is required`);
        return value;
    }

    private async getLocation(args: ToolArgs, direction: 'departures' | 'arrivals') {
        const params: QueryParams = {
            code: this.requiredString(args, 'station'),
            filterFrom: direction === 'arrivals' ? this.value(args, 'fromStation') as string : undefined,
            filterTo: direction === 'departures' ? this.value(args, 'toStation') as string : undefined,
            timeFrom: this.value(args, 'timeFrom') as string,
            timeTo: this.value(args, 'timeTo') as string,
            timeWindow: this.value(args, 'timeWindow') as number,
            detailed: this.value(args, 'detailed') as boolean,
        };
        const data = await this.makeApiRequest<LocationResponse>('/gb-nr/location', params);
        const services = data?.services ?? [];
        let result = `${direction === 'departures' ? 'Departures' : 'Arrivals'} for ${this.locationName(data?.query?.location)}\n`;
        if (data?.query?.timeFrom) result += `Window: ${data.query.timeFrom}${data.query.timeTo ? ` to ${data.query.timeTo}` : ''}\n`;
        result += `\n${services.length ? services.map((service) => this.formatLineupService(service)).join('\n') : 'No services found.'}`;
        return this.textResult(result.trim());
    }

    private async getNetworkRailService(args: ToolArgs) {
        const uniqueIdentity = this.value(args, 'uniqueIdentity') as string;
        const identity = this.value(args, 'identity') as string;
        const departureDate = this.value(args, 'departureDate') as string;
        if (!uniqueIdentity && (!identity || !departureDate)) throw new Error('Provide uniqueIdentity or both identity and departureDate');
        const data = await this.makeApiRequest<ServiceResponse>('/gb-nr/service', { uniqueIdentity, identity, departureDate, detailed: this.value(args, 'detailed') as boolean });
        const service = data?.service;
        if (!service) return this.textResult('Service not found.');
        const metadata = service.scheduleMetadata;
        let result = `Service ${metadata?.uniqueIdentity ?? data?.query?.uniqueIdentity ?? 'unknown'}\n${this.formatMetadata(metadata)}`;
        result += `From: ${this.formatPairs(service.origin)}\nTo: ${this.formatPairs(service.destination)}\n\n`;
        result += service.locations?.length ? service.locations.map((location) => this.formatServiceLocation(location)).join('\n') : 'No locations found.';
        if (service.allocationData?.length) result += `\n\nAllocations:\n${service.allocationData.map((allocation) => this.formatAllocation(allocation)).join('\n')}`;
        return this.textResult(result.trim());
    }

    private async getAllocationsByService(args: ToolArgs) {
        const data = await this.makeApiRequest<AllocationsByServiceResponse>('/gb-nr/allocations/by-service', { departureDate: this.requiredString(args, 'departureDate'), toc: this.requiredString(args, 'toc') });
        const services = data?.services ?? [];
        const result = services.length ? services.map((service) => `${this.formatMetadata(service.scheduleMetadata)}From: ${this.formatPairs(service.origin)}\nTo: ${this.formatPairs(service.destination)}\n${(service.allocations ?? []).map((allocation) => this.formatAllocation(allocation)).join('\n')}`).join('\n') : 'No allocations found.';
        return this.textResult(result.trim());
    }

    private async getAllocationsByClass(args: ToolArgs) {
        const data = await this.makeApiRequest<AllocationsByClassResponse>('/gb-nr/allocations/by-class', { departureDate: this.requiredString(args, 'departureDate'), class: this.requiredString(args, 'class') });
        const identities = data?.identities ?? {};
        const result = Object.entries(identities).length ? Object.entries(identities).map(([identity, allocations]) => `Class member ${identity}\n${allocations.map((allocation) => this.formatAllocation(allocation)).join('\n')}`).join('\n') : 'No allocations found.';
        return this.textResult(result.trim());
    }

    private formatLineupService(service: NetworkRailLocationLineUpObject): string {
        const temporal = service.temporalData;
        let result = `Service ${service.scheduleMetadata?.uniqueIdentity ?? service.scheduleMetadata?.identity ?? 'unknown'}\n${this.formatMetadata(service.scheduleMetadata)}`;
        result += `From: ${this.formatPairs(service.origin)}\nTo: ${this.formatPairs(service.destination)}\n`;
        result += this.formatTemporal('Departure', temporal?.departure) + this.formatTemporal('Arrival', temporal?.arrival);
        const platform = service.locationMetadata?.platform;
        if (platform?.actual || platform?.planned) result += `Platform: ${platform.actual ?? platform.planned}\n`;
        if (temporal?.displayAs) result += `Status: ${temporal.displayAs}\n`;
        if (service.reasons?.length) result += `Reasons: ${service.reasons.map((reason) => reason.shortText ?? reason.code).filter(Boolean).join('; ')}\n`;
        return result;
    }

    private formatServiceLocation(location: NetworkRailServiceLocation): string {
        let result = `${this.locationName(location.location)}\n`;
        result += this.formatTemporal('Arrival', location.temporalData?.arrival) + this.formatTemporal('Departure', location.temporalData?.departure);
        const platform = location.locationMetadata?.platform;
        if (platform?.actual || platform?.planned) result += `Platform: ${platform.actual ?? platform.planned}\n`;
        return result;
    }

    private formatMetadata(metadata: NetworkRailLocationLineUpObject['scheduleMetadata']): string {
        if (!metadata) return '';
        const operator = metadata.operator?.name ?? metadata.operator?.code;
        let result = operator ? `Operator: ${operator}\n` : '';
        if (metadata.trainReportingIdentity) result += `Train: ${metadata.trainReportingIdentity}\n`;
        if (metadata.modeType || metadata.inPassengerService !== undefined) result += `Type: ${metadata.modeType ?? 'TRAIN'}${metadata.inPassengerService === undefined ? '' : metadata.inPassengerService ? ' (Passenger)' : ' (Freight)'}\n`;
        return result;
    }

    private formatTemporal(label: string, temporal?: IndividualTemporalData): string {
        if (!temporal) return '';
        const scheduled = temporal.scheduleAdvertised ?? temporal.scheduleInternal;
        const actual = temporal.realtimeActual ?? temporal.realtimeForecast ?? temporal.realtimeEstimate;
        let result = scheduled ? `${label} scheduled: ${scheduled}\n` : '';
        if (actual) result += `${label} ${temporal.realtimeActual ? 'actual' : 'expected'}: ${actual}\n`;
        if (temporal.realtimeAdvertisedLateness !== undefined) result += `Delay: ${temporal.realtimeAdvertisedLateness > 0 ? '+' : ''}${temporal.realtimeAdvertisedLateness} minutes\n`;
        if (temporal.isCancelled) result += `${label}: Cancelled\n`;
        return result;
    }

    private formatPairs(pairs?: LocationPair[]): string {
        return pairs?.map((pair) => pair.location?.description ?? pair.location?.shortCodes?.[0]).filter(Boolean).join(', ') || 'Unknown';
    }

    private formatAllocation(allocation: Allocation): string {
        const items = allocation.allocationItems?.map((item) => `${item.stockType ?? 'stock'} ${item.identity ?? '(identity suppressed)'}`).join(', ');
        return `Allocation ${allocation.allocationIndex ?? 'unknown'}: ${items || 'No vehicle details'}`;
    }

    private locationName(location?: GeographicLocation): string {
        return location?.description ?? location?.shortCodes?.join(', ') ?? 'Unknown location';
    }

    private textResult(text: string) { return { content: [{ type: 'text' as const, text }] }; }

    async run() {
        try {
            await this.server.connect(new StdioServerTransport());
            console.error('National Rail MCP server running on stdio');
        } catch (error) {
            console.error('National Rail MCP failed to start:', error);
            process.exit(1);
        }
    }
}

const server = new NationalRailMCPServer();
server.run().catch(console.error);