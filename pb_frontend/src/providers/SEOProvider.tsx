import { Helmet } from 'react-helmet-async'

type SEOProviderTypes = {
    title?: string
    description?: string
    keywords?: string
    image?: string
    noindex?: boolean
}

function SEOProvider({
    title = 'Portable Badge – On-Chain Document Verification',
    description = 'Verify and issue tamper-proof credentials on the Sui blockchain. Portable Badge provides decentralized document verification you can trust.',
    keywords = 'portable badge, document verification, blockchain credentials, Sui, on-chain verification, decentralized identity, tamper-proof certificates, NFT badge',
    image = '/auth-preview.webp',
}: SEOProviderTypes) {
    const canonical =
    typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : ''

    return (
        <Helmet>
            <title>{title}</title>

            <meta name='description' content={description} />
            <meta name='keywords' content={keywords} />
            <meta name="robots" content="index, follow" />

            <link rel='canonical' href={canonical} />

            <meta property='og:title' content={title} />
            <meta property='og:description' content={description} />
            <meta property='og:type' content='website' />
            <meta property='og:url' content={canonical} />
            <meta property='og:image' content={image} />

            <meta name='twitter:card' content='summary_large_image' />
            <meta name='twitter:title' content={title} />
            <meta name='twitter:description' content={description} />
            <meta name='twitter:image' content={image} />
        </Helmet>
    )
}

export default SEOProvider