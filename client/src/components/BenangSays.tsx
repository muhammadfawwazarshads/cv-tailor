import type { ReactNode } from "react";
import { Mascot, type MascotPose } from "./Mascot";

/** Benang talking to the user: the mascot beside a speech bubble, with optional actions under the text. */
export function BenangSays({ pose = "point-right", children, actions }: { pose?: MascotPose; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="says">
      <Mascot size={84} pose={pose} />
      <div className="says-bubble">
        {children}
        {actions && <div className="says-actions">{actions}</div>}
      </div>
    </div>
  );
}
