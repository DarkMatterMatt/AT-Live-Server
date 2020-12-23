import { TemplatedApp } from "uWebSockets.js";

let instance: WSOutput | null = null;

export class WSOutput implements Output {
    private app: TemplatedApp;

    private constructor(app: TemplatedApp) {
        this.app = app;
    }

    public static getInstance(): WSOutput {
        if (instance == null) {
            throw new Error("Output instance is null. Call Output.createInstance first");
        }
        return instance;
    }

    public static createInstance(app: TemplatedApp): WSOutput {
        if (instance != null) {
            throw new Error("Output instance has already been initialized");
        }
        instance = new WSOutput(app);
        return instance;
    }

    public publish(shortName: string, data: OutputVehicle): void {
        this.app.publish(shortName, JSON.stringify(data));
    }
}
