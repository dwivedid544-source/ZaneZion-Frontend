import React from 'react';

const ProgressBar = ({ label, progress, color = 'bg-accent' }) => {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-secondary font-medium">{label}</span>
        <span className="text-accent font-bold">{progress}%</span>
      </div>
      <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-1000 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
