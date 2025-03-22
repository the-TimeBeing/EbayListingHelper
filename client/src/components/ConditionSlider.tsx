import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { ConditionOption } from "@shared/types";

const CONDITIONS: ConditionOption[] = [
  { id: 1, label: "Used - Poor", description: "<strong>Used - Poor:</strong> Item has significant wear or damage but is still functional. May have multiple flaws or require repair." },
  { id: 2, label: "Used - Fair", description: "<strong>Used - Fair:</strong> Item works but shows noticeable wear. May have cosmetic issues or minor functional problems." },
  { id: 3, label: "Used - Good", description: "<strong>Used - Good:</strong> Item shows some signs of use but is in good working condition. Minor scratches or marks may be present." },
  { id: 4, label: "Like New", description: "<strong>Like New:</strong> Item appears almost unused with minimal signs of wear. All original accessories included if applicable." },
  { id: 5, label: "New", description: "<strong>New:</strong> Brand new, unused item in original packaging with all original tags/accessories." }
];

interface ConditionSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export default function ConditionSlider({ value, onChange }: ConditionSliderProps) {
  const [sliderValue, setSliderValue] = useState(value);
  
  useEffect(() => {
    setSliderValue(value);
  }, [value]);

  const handleChange = (newValue: number[]) => {
    const value = newValue[0];
    setSliderValue(value);
    onChange(value);
  };

  const currentCondition = CONDITIONS.find(c => c.id === sliderValue) || CONDITIONS[2];

  return (
    <div>
      <Label className="block text-lg font-medium mb-2">Item Condition</Label>
      <div className="mb-4">
        <Slider 
          value={[sliderValue]} 
          min={1} 
          max={5} 
          step={1} 
          onValueChange={handleChange}
          className="h-2 bg-gray-200"
        />
      </div>
      <div className="flex justify-between text-sm text-gray-500">
        <span>Used - Poor</span>
        <span>Used - Fair</span>
        <span>Used - Good</span>
        <span>Like New</span>
        <span>New</span>
      </div>
      <div className="mt-4 p-3 bg-gray-100 rounded-lg">
        <p 
          className="text-gray-800"
          dangerouslySetInnerHTML={{ __html: currentCondition.description }}
        />
      </div>
    </div>
  );
}
