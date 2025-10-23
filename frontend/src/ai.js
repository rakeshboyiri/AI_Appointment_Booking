import Vapi from "@vapi-ai/web";

// Initialize VAPI with your API key
export const vapi = new Vapi(import.meta.env.VITE_VAPI_API_KEY);
const assistantId = import.meta.env.VITE_ASSISTANT_ID;

export const startAssistant = async () => {
    try {
        const response = await vapi.start(assistantId);
        console.log("VAPI Assistant started:", response.id);
        return response.id;
    } catch (error) {
        console.error("Error starting VAPI assistant:", error);
        throw error;
    }
};

export const stopAssistant = async () => {
    try {
        await vapi.stop();
        console.log("VAPI Assistant stopped");
    } catch (error) {
        console.error("Error stopping VAPI assistant:", error);
        throw error;
    }
};
