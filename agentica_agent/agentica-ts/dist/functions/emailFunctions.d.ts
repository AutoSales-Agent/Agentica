export declare function generateInitialEmail({ userPrompt }: {
    userPrompt: string;
}): Promise<any[]>;
export declare function generateFollowupEmail({ userPrompt }: {
    userPrompt: string;
}): Promise<{
    status: string;
    error: string;
    subject?: undefined;
    body?: undefined;
} | {
    subject: any;
    body: any;
    status: string;
    error?: undefined;
}>;
export declare function regenerateEmailWithFeedback({ userPrompt }: {
    userPrompt: string;
}): Promise<{
    status: string;
    error: string;
    subject?: undefined;
    body?: undefined;
} | {
    subject: any;
    body: any;
    status: string;
    error?: undefined;
}>;
export declare function analyzeEmailIssues({ userPrompt }: {
    userPrompt: string;
}): Promise<any>;
export declare function handleEmailRejection({ userPrompt }: {
    userPrompt: string;
}): Promise<{
    status: string;
    error: string;
    subject?: undefined;
    body?: undefined;
} | {
    subject: any;
    body: any;
    status: string;
    error?: undefined;
} | {
    action: string;
    analysis: any;
    message: string;
}>;
export declare function generateEmailsForMultipleLeads({ userPrompt }: {
    userPrompt: string;
}): Promise<{
    status: string;
    error: string;
    type?: undefined;
    projectId?: undefined;
    results?: undefined;
} | {
    type: string;
    projectId: any;
    results: ({
        leadId: any;
        subject: any;
        body: any;
        status: string;
        error?: undefined;
    } | {
        leadId: any;
        status: string;
        error: string;
        subject?: undefined;
        body?: undefined;
    })[];
    status?: undefined;
    error?: undefined;
}>;
