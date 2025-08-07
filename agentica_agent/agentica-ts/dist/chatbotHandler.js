// chatbotHandler.ts
import { analyzePromptAI } from './analyzePromptAI.js';
import * as projectFuncs from './functions/projectFunctions.js';
import * as leadFuncs from './functions/leadFunctions.js';
import * as emailFuncs from './functions/emailFunctions.js';
export async function chatbotHandler(input) {
    const { intent, extracted_params } = await analyzePromptAI(input);
    switch (intent) {
        case 'register_project':
            return await projectFuncs.createProject(extracted_params);
        case 'register_lead':
            return await leadFuncs.createLead(extracted_params);
        case 'connect_leads':
            return await leadFuncs.autoConnectLeads(extracted_params);
        case 'initial_email':
            return await emailFuncs.generateInitialEmail(extracted_params);
        case 'followup_email':
            return await emailFuncs.generateFollowupEmail(extracted_params);
        case 'email_rewrite_request':
            return await emailFuncs.regenerateEmailWithFeedback(extracted_params);
        case 'analyze_email':
            return await emailFuncs.analyzeEmailIssues(extracted_params);
        case 'handle_email_rejection':
            return await emailFuncs.handleEmailRejection(extracted_params);
        case 'list_projects':
            return await projectFuncs.listProjects();
        case 'list_leads':
            return await leadFuncs.listLeads();
        case 'list_emails':
            return await emailFuncs.listEmails();
        default:
            return { message: '의도를 이해하지 못했습니다.' };
    }
}
