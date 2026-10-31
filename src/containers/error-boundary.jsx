import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import BrowserModalComponent from '../components/browser-modal/browser-modal.jsx';
import CrashMessageComponent from '../components/crash-message/crash-message.jsx';
import log from '../lib/log.js';
import {recommendedBrowser} from '../lib/supported-browser';

class ErrorBoundary extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            error: null,
            errorInfo: null
        };
    }

    /**
     * Handle an error caught by this ErrorBoundary component.
     * @param {Error} error - the error that was caught.
     * @param {React.ErrorInfo} errorInfo - the React error info associated with the error.
     */
    componentDidCatch (error, errorInfo) {
        error = error || {
            stack: 'Unknown stack',
            message: 'Unknown error'
        };
        errorInfo = errorInfo || {
            componentStack: 'Unknown component stack'
        };

        // only remember the first error: later errors might just be side effects of that first one
        if (!this.state.error) {
            // store error & errorInfo for debugging
            this.setState({
                error,
                errorInfo
            });
        }

        // report every error in the console
        log.error([
            `Unhandled Error with action='${this.props.action}': ${error.stack}`,
            `Component stack: ${errorInfo.componentStack}`
        ].join('\n'));
    }

    handleBack () {
        window.history.back();
    }

    handleReload () {
        window.location.replace(window.location.origin + window.location.pathname);
    }

    render () {
        if (this.state.error) {
            // JARVIS 二次开发：把真实报错直接显示在崩溃页上，方便在没有控制台的设备（平板/手机）上排查。
            const err = this.state.error;
            const stack = (err && (err.stack || err.message)) || 'Unknown error';
            const compStack = (this.state.errorInfo && this.state.errorInfo.componentStack) || '';
            return (
                <div style={{
                    position: 'fixed', inset: 0, overflow: 'auto', zIndex: 99999,
                    background: '#1b2838', color: '#ffd2d2',
                    font: '12px/1.5 ui-monospace, Menlo, Consolas, monospace',
                    padding: '20px', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                    <div style={{color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 8}}>
                        运行时报错（JARVIS 诊断）：{String(err && err.message || err)}
                    </div>
                    <div style={{marginBottom: 12}}>{String(stack)}</div>
                    {compStack ? (
                        <div style={{color: '#9fd0ff'}}>组件栈：{String(compStack)}</div>
                    ) : null}
                    <button
                        onClick={this.handleReload}
                        style={{
                            marginTop: 16, padding: '8px 16px', borderRadius: 8,
                            border: '1px solid #5a7', background: '#2b6', color: '#042',
                            fontWeight: 700, cursor: 'pointer'
                        }}
                    >重新载入</button>
                </div>
            );
        }
        return this.props.children;
    }
}

ErrorBoundary.propTypes = {
    action: PropTypes.string.isRequired, // Used for defining tracking action
    children: PropTypes.node,
    isRtl: PropTypes.bool
};

const mapStateToProps = state => ({
    isRtl: state.locales.isRtl
});

// no-op function to prevent dispatch prop being passed to component
const mapDispatchToProps = () => ({});

export default connect(mapStateToProps, mapDispatchToProps)(ErrorBoundary);
