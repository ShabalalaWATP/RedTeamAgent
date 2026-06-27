import logo from '../assets/redteamagent-logo.png';
import './orbitalCore.css';

/**
 * Decorative 3D "decision core": concentric orbital rings rendered with pure
 * CSS 3D transforms around the brand mark. No WebGL or third-party dependency,
 * GPU-accelerated, and frozen by reduced-motion and snapshot tooling.
 */
export function OrbitalCore() {
  return (
    <div className="orbital-core" aria-hidden="true">
      <span className="orbital-glow" />
      <div className="orbital-ring orbital-ring-1"><i className="orbital-node" /></div>
      <div className="orbital-ring orbital-ring-2"><i className="orbital-node" /></div>
      <div className="orbital-ring orbital-ring-3" />
      <img className="orbital-logo" src={logo} alt="" width="140" height="140" />
    </div>
  );
}
