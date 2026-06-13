// Maps backend status codes to user-friendly labels + colors.
// The UI speaks the user's language; the backend keeps its technical codes.
export interface FriendlyStatus { label: string; color: string; dot: string; }

export function friendlyStatus(status: string): FriendlyStatus {
  switch (status) {
    case 'indexed':    return { label: 'Ready',            color: '#0b5e4d', dot: '#1d9e75' };
    case 'processing': return { label: 'Preparing…',       color: '#9a6700', dot: '#ef9f27' };
    case 'pending':    return { label: 'Preparing…',       color: '#9a6700', dot: '#ef9f27' };
    case 'failed':     return { label: "Couldn't process", color: '#a32d2d', dot: '#e24b4a' };
    case 'duplicate':  return { label: 'Already uploaded',  color: '#5f5e5a', dot: '#888780' };
    default:           return { label: status,             color: '#5f5e5a', dot: '#888780' };
  }
}