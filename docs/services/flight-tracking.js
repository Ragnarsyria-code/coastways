export class FlightTrackingService {
  constructor({ provider = null, apiKey = null } = {}) {
    this.provider = provider;
    this.apiKey = apiKey;
  }

  get isConfigured() {
    return Boolean(this.provider && this.apiKey);
  }

  async track({ flightNumber, flightDate }) {
    if (!this.isConfigured) {
      return {
        configured: false,
        flightNumber,
        flightDate,
        airline: null,
        departureAirport: null,
        arrivalAirport: null,
        scheduledArrival: null,
        estimatedArrival: null,
        actualArrival: null,
        status: null,
        delay: null,
      };
    }

    throw new Error("Flight tracking provider adapter is not configured.");
  }
}

export const flightTrackingService = new FlightTrackingService();
