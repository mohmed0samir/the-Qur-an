import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Shown above the retry button. */
  title?: string;
  /** Called when the user presses retry, before the boundary resets. */
  onReset?: () => void;
}

interface State {
  failed: boolean;
}

/** Catches render errors so one broken view never blanks the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("UI error:", error, info.componentStack);
  }

  private reset = () => {
    this.props.onReset?.();
    this.setState({ failed: false });
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container page" role="alert">
        <div className="error-box">
          <h3>{this.props.title ?? "حدث خطأ غير متوقع"}</h3>
          <p>تعذّر عرض هذه الصفحة. بياناتك المحفوظة (المحفوظات وموضع القراءة) لم تتأثر.</p>
          <button type="button" className="btn btn--primary" onClick={this.reset}>
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }
}
