
'use client';

import { useState, type ReactNode, useCallback } from 'react';
import Header from '@/components/app/header';
import InputForm, { type InputType } from '@/components/app/input-form';
import OutputCard from '@/components/app/output-card';
import MemoryLogDisplay, { type LogEntry } from '@/components/app/memory-log-display';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { fileToDataUri } from '@/lib/utils';

import { classifyDocument, type ClassifyDocumentInput, type ClassifyDocumentOutput } from '@/ai/flows/classify-document';
import { extractEmailData, type ExtractEmailDataInput, type ExtractEmailDataOutput } from '@/ai/flows/extract-email-data';
import { parseJsonWebhook, type ParseJsonWebhookInput, type ParseJsonWebhookOutput } from '@/ai/flows/parse-json-webhook';
import { extractPdfData, type ExtractPdfDataInput, type ExtractPdfDataOutput } from '@/ai/flows/extract-pdf-data';
import { routeAction, type RouteActionInput, type RouteActionOutput } from '@/ai/flows/route-action';

import {
  Mail, Braces, FileText, Filter, Route as RouteIcon, MessageCircleWarning, HelpCircle, Receipt, Gavel, ShieldAlert, Cog, Trash2
} from 'lucide-react';

const App = () => {
  const [inputType, setInputType] = useState<InputType>('Email');
  const [inputValue, setInputValue] = useState<string>('');
  const [inputFile, setInputFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const [classifierOutput, setClassifierOutput] = useState<ClassifyDocumentOutput | null>(null);
  const [classifierError, setClassifierError] = useState<string | null>(null);

  const [specializedAgentOutput, setSpecializedAgentOutput] = useState<ExtractEmailDataOutput | ParseJsonWebhookOutput | ExtractPdfDataOutput | null>(null);
  const [specializedAgentError, setSpecializedAgentError] = useState<string | null>(null);
  const [specializedAgentName, setSpecializedAgentName] = useState<string>('Specialized Agent');
  
  const [actionRouterOutput, setActionRouterOutput] = useState<RouteActionOutput | null>(null);
  const [actionRouterError, setActionRouterError] = useState<string | null>(null);

  const [memoryLog, setMemoryLog] = useState<LogEntry[]>([]);
  const { toast } = useToast();

  const resetOutputCards = useCallback(() => {
    setClassifierOutput(null);
    setClassifierError(null);
    setSpecializedAgentOutput(null);
    setSpecializedAgentError(null);
    setActionRouterOutput(null);
    setActionRouterError(null);
    // Note: setMemoryLog([]) is removed from here
  }, [ 
    setClassifierOutput, setClassifierError, 
    setSpecializedAgentOutput, setSpecializedAgentError, 
    setActionRouterOutput, setActionRouterError, 
  ]);

  const handleClearLog = useCallback(() => {
    setMemoryLog([]); // This will permanently clear the log
    toast({ title: "Memory Log Cleared", description: "All log entries have been removed." });
  }, [toast, setMemoryLog]);


  const getIconForIntent = (intent?: string): ReactNode => {
    switch (intent) {
      case 'RFQ': return <HelpCircle className="h-5 w-5 text-primary" />;
      case 'Complaint': return <MessageCircleWarning className="h-5 w-5 text-primary" />;
      case 'Invoice': return <Receipt className="h-5 w-5 text-primary" />;
      case 'Regulation': return <Gavel className="h-5 w-5 text-primary" />;
      case 'Fraud Risk': return <ShieldAlert className="h-5 w-5 text-primary" />;
      default: return <Cog className="h-5 w-5 text-primary" />;
    }
  };
  
  const getIconForFormat = (format?: string): ReactNode => {
     switch (format) {
      case 'Email': return <Mail className="h-5 w-5 text-primary" />;
      case 'JSON': return <Braces className="h-5 w-5 text-primary" />;
      case 'PDF': return <FileText className="h-5 w-5 text-primary" />;
      default: return <Cog className="h-5 w-5 text-primary" />;
    }
  };


  const handleProcessRequest = useCallback(async () => {
    setIsLoading(true);
    resetOutputCards(); // Clears only output cards, not the memory log

    const logsForThisRun: LogEntry[] = [];
    const addLogEntryForCurrentRun = (logData: Omit<LogEntry, 'timestamp'>) => {
        logsForThisRun.push({ timestamp: new Date().toISOString(), ...logData } as LogEntry);
    };

    let currentDocumentContent = inputValue;
    if (inputType === 'PDF' && inputFile) {
      try {
        currentDocumentContent = await fileToDataUri(inputFile);
      } catch (error) {
        toast({ title: "Error reading PDF", description: "Could not read the PDF file.", variant: "destructive" });
        setSpecializedAgentError("Failed to read PDF file.");
        setMemoryLog(prevLogs => [...prevLogs, ...logsForThisRun]); 
        setIsLoading(false);
        return;
      }
    } else if (inputType === 'PDF' && !inputFile) {
        toast({ title: "Missing PDF File", description: "Please select a PDF file to process.", variant: "destructive" });
        setMemoryLog(prevLogs => [...prevLogs, ...logsForThisRun]);
        setIsLoading(false);
        return;
    } else if (inputType !== 'PDF' && !inputValue.trim()){
        toast({ title: "Missing Input", description: `Please provide content for ${inputType}.`, variant: "destructive" });
        setMemoryLog(prevLogs => [...prevLogs, ...logsForThisRun]);
        setIsLoading(false);
        return;
    }


    let classifiedIntent: string | undefined;
    let classifiedFormat: string | undefined;
    const classifierInput: ClassifyDocumentInput = { documentContent: inputType === 'PDF' ? `PDF File: ${inputFile?.name}` : inputValue, documentFormat: inputType };
    try {
      addLogEntryForCurrentRun({ agent: "Classifier", input: classifierInput, output: "Processing..." });
      const output = await classifyDocument(classifierInput);
      setClassifierOutput(output);
      classifiedIntent = output.intent;
      classifiedFormat = output.format;
      addLogEntryForCurrentRun({ agent: "Classifier", input: classifierInput, output });
      toast({ title: "Classifier Success", description: `Document classified as ${output.format} - ${output.intent}` });
    } catch (error: any) {
      setClassifierError(error.message || "Error in Classifier Agent");
      addLogEntryForCurrentRun({ agent: "Classifier", input: classifierInput, output: { error: error.message } });
      toast({ title: "Classifier Error", description: error.message, variant: "destructive" });
      setMemoryLog(prevLogs => [...prevLogs, ...logsForThisRun]);
      setIsLoading(false);
      return;
    }

    let agentOutputForRouter: any = null;
    let currentSpecializedAgentName = 'Specialized Agent'; 
    if (classifiedFormat) {
      let specializedOutput;
      let specializedInput: any; 
      try {
        if (classifiedFormat === 'Email') {
          currentSpecializedAgentName = 'Email Agent';
          specializedInput = { emailContent: inputValue };
          addLogEntryForCurrentRun({ agent: currentSpecializedAgentName, input: specializedInput, output: "Processing..." });
          specializedOutput = await extractEmailData(specializedInput as ExtractEmailDataInput);
        } else if (classifiedFormat === 'JSON') {
          currentSpecializedAgentName = 'JSON Agent';
          specializedInput = { webhookData: inputValue };
          addLogEntryForCurrentRun({ agent: currentSpecializedAgentName, input: specializedInput, output: "Processing..." });
          specializedOutput = await parseJsonWebhook(specializedInput as ParseJsonWebhookInput);
        } else if (classifiedFormat === 'PDF') {
          currentSpecializedAgentName = 'PDF Agent';
          specializedInput = { pdfDataUri: currentDocumentContent }; 
          addLogEntryForCurrentRun({ agent: currentSpecializedAgentName, input: { pdfFileName: inputFile?.name }, output: "Processing..." });
          specializedOutput = await extractPdfData(specializedInput as ExtractPdfDataInput);
        }
        setSpecializedAgentName(currentSpecializedAgentName); 
        setSpecializedAgentOutput(specializedOutput || null);
        agentOutputForRouter = specializedOutput;
        addLogEntryForCurrentRun({ agent: currentSpecializedAgentName, input: specializedInput, output: specializedOutput });
        toast({ title: `${currentSpecializedAgentName} Success`, description: "Data extracted successfully." });
      } catch (error: any) {
        setSpecializedAgentName(currentSpecializedAgentName); 
        setSpecializedAgentError(error.message || `Error in ${currentSpecializedAgentName}`);
        addLogEntryForCurrentRun({ agent: currentSpecializedAgentName, input: specializedInput, output: { error: error.message } });
        toast({ title: `${currentSpecializedAgentName} Error`, description: error.message, variant: "destructive" });
        setMemoryLog(prevLogs => [...prevLogs, ...logsForThisRun]);
        setIsLoading(false);
        return;
      }
    }

    if (agentOutputForRouter && classifiedIntent && classifiedFormat) {
      const routerInput: RouteActionInput = { agentOutput: agentOutputForRouter, intent: classifiedIntent, format: classifiedFormat };
      try {
        const output = await routeAction(routerInput);
        setActionRouterOutput(output);
        addLogEntryForCurrentRun({ agent: "Action Router", input: routerInput, output, action: `Action: ${output.actionTaken}` });
        toast({ title: "Action Router Success", description: `Action triggered: ${output.actionTaken}` });
      } catch (error: any) {
        setActionRouterError(error.message || "Error in Action Router");
        addLogEntryForCurrentRun({ agent: "Action Router", input: routerInput, output: { error: error.message } });
        toast({ title: "Action Router Error", description: error.message, variant: "destructive" });
      }
    }
    
    setMemoryLog(prevLogs => [...prevLogs, ...logsForThisRun]); // Append logs for this run to existing logs
    setIsLoading(false);
  }, [
    inputValue, inputFile, inputType, 
    resetOutputCards, // resetOutputCards instead of resetOutputs
    toast, 
    // Dependencies for setClassifierOutput, setClassifierError, etc. are implicitly handled by React
  ]);

  const currentSpecializedAgentIcon = getIconForFormat(classifierOutput?.format);
  const actionRouterLogs = memoryLog.filter(log => log.agent === "Action Router");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header appName="Context Chained AI Actions" />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
             <InputForm
              inputType={inputType}
              setInputType={setInputType}
              inputValue={inputValue}
              setInputValue={setInputValue}
              inputFile={inputFile}
              setInputFile={setInputFile}
              onSubmit={handleProcessRequest}
              isLoading={isLoading}
            />
          </div>

          <OutputCard
            title="Classifier Agent Output"
            description="Identifies document format and business intent."
            icon={<Filter className="h-5 w-5 text-primary" />}
            data={classifierOutput}
            isLoading={isLoading && !classifierOutput && !classifierError}
            error={classifierError}
          />
          
          <OutputCard
            title={`${specializedAgentName} Output`}
            description={`Extracts data specific to ${classifierOutput?.format || 'the document type'}.`}
            icon={currentSpecializedAgentIcon}
            data={specializedAgentOutput}
            isLoading={isLoading && !!classifierOutput && !specializedAgentOutput && !specializedAgentError}
            error={specializedAgentError}
          />

          <OutputCard
            title="Action Router Output"
            description="Determines and simulates follow-up actions."
            icon={<RouteIcon className="h-5 w-5 text-primary" />}
            data={actionRouterOutput}
            isLoading={isLoading && !!specializedAgentOutput && !actionRouterOutput && !actionRouterError}
            error={actionRouterError}
          />

          <div className="md:col-span-2 space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClearLog} disabled={memoryLog.length === 0}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Log
              </Button>
            </div>
            <MemoryLogDisplay logs={actionRouterLogs} />
          </div>
        </div>
      </main>
      <footer className="text-center py-4 text-sm text-muted-foreground border-t border-border">
        Context Chained Al Actions &copy; 2025
      </footer>
    </div>
  );
};

export default App;
    
