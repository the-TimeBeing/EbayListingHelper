import { Check, RefreshCw } from "lucide-react";

const steps = [
  { id: 'analyzing_photos', label: 'Analyzing photos' },
  { id: 'searching_similar_items', label: 'Finding similar sold items' },
  { id: 'generating_content', label: 'Creating listing title and description' },
  { id: 'setting_price', label: 'Setting optimal price based on sales data' },
  { id: 'creating_draft', label: 'Saving draft to your eBay account' }
];

interface ProcessStepsProps {
  currentStep: string;
}

export default function ProcessSteps({ currentStep }: ProcessStepsProps) {
  return (
    <div id="process-steps">
      {steps.map((step) => {
        // Determine status
        let status: 'completed' | 'active' | 'pending' = 'pending';
        
        if (step.id === currentStep) {
          status = 'active';
        } else if (
          steps.findIndex(s => s.id === step.id) < 
          steps.findIndex(s => s.id === currentStep)
        ) {
          status = 'completed';
        }
        
        return (
          <div key={step.id} className="process-step flex items-center mb-3">
            <span 
              className={`inline-block w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                status === 'completed' ? 'bg-green-600 text-white' : 
                status === 'active' ? 'bg-[#0064d2] text-white animate-pulse' : 
                'bg-gray-200 text-gray-500'
              }`}
            >
              {status === 'completed' ? (
                <Check className="h-4 w-4" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </span>
            <span 
              className={`${
                status === 'active' ? 'text-gray-800 font-medium' : 
                status === 'completed' ? 'text-gray-800' : 
                'text-gray-500'
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
