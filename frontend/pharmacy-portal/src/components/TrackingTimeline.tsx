import { Hub } from '@/types/order';
import { CheckCircle, Circle, Clock } from 'lucide-react';

interface TrackingTimelineProps {
  hubs: Hub[];
}

export const TrackingTimeline = ({ hubs }: TrackingTimelineProps) => {
  return (
    <div className="relative">
      {hubs.map((hub, index) => (
        <div key={hub.id} className="flex gap-4 pb-8 last:pb-0">
          {/* Timeline connector */}
          <div className="flex flex-col items-center">
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-full border-2
              ${hub.status === 'completed' ? 'bg-success border-success' : ''}
              ${hub.status === 'current' ? 'bg-primary border-primary animate-pulse' : ''}
              ${hub.status === 'pending' ? 'bg-muted border-muted' : ''}
            `}>
              {hub.status === 'completed' && <CheckCircle className="h-5 w-5 text-success-foreground" />}
              {hub.status === 'current' && <Clock className="h-5 w-5 text-primary-foreground" />}
              {hub.status === 'pending' && <Circle className="h-5 w-5 text-muted-foreground" />}
            </div>
            {index < hubs.length - 1 && (
              <div className={`
                w-0.5 h-full min-h-[60px] mt-2
                ${hub.status === 'completed' ? 'bg-success' : 'bg-muted'}
              `} />
            )}
          </div>

          {/* Hub content */}
          <div className="flex-1 pb-2">
            <h4 className={`
              font-semibold mb-1
              ${hub.status === 'completed' ? 'text-foreground' : ''}
              ${hub.status === 'current' ? 'text-primary' : ''}
              ${hub.status === 'pending' ? 'text-muted-foreground' : ''}
            `}>
              {hub.name}
            </h4>
            <p className={`
              text-sm mb-1
              ${hub.status === 'pending' ? 'text-muted-foreground italic' : 'text-muted-foreground'}
            `}>
              {hub.location}
            </p>
            {hub.timestamp && (
              <p className="text-xs text-muted-foreground">
                {new Date(hub.timestamp).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
