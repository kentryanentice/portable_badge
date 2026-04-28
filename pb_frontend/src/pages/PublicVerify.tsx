import Verify from './Verify'

function PublicVerify() {
    return (
        <div className="public-verify">
            <main className="public-verify-main">
                <Verify />
            </main>
            <footer className="public-verify-footer">
                Verification is free and requires no wallet. Powered by Stellar.
            </footer>
        </div>
    )
}

export default PublicVerify
