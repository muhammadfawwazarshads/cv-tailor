import type { ReactNode } from "react";
import { Mascot, type MascotPose, type Wear } from "./Mascot";

/** Benang talking to the user: the mascot beside a speech bubble, with optional actions under the text. */
export function BenangSays({ pose = "point-right", wear, children, actions }: { pose?: MascotPose; wear?: Wear[]; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="says">
      <Mascot size={84} pose={pose} wear={wear} />
      <div className="says-bubble">
        {children}
        {actions && <div className="says-actions">{actions}</div>}
      </div>
    </div>
  );
}
