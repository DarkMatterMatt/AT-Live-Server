import { TemplatedApp } from "uWebSockets.js";

export class WSOutput implements Output {
    private app: TemplatedApp;

    public constructor(app: TemplatedApp) {
        this.app = app;
    }

    public publish(shortName: string, data: OutputVehicle): void {
        this.app.publish(shortName, JSON.stringify(data));
    }
}
