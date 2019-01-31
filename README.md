# Serverless Lambda NodeJS Sitemap generator function

## Use case
- connect to **mysql** to fetch dynamic urls
- generate **sitemaps** in batches of 10000 urls 
- generate **sitemapindex** linking all sitemaps
- **gz** compression and upload to **s3**
- ping google for sitemap update
- requires nodejs 8+ for async/await

The `handler.sitemap` function handles connections directly to the database to extract all usernames for which urls should be added to the sitemap.
Next it generates a sitemap, batched into files of 10000 urls, compresses this and uploades it to the s3 bucket provided in the event configuration.
Finally it pings google to say a new sitemap was generated for this website.


## Event parameters:

- **site_url** - Url of the website the sitemap is generated for eg: https://www.mywebpage.com
- **sitemap_bucket** - S3 Bucket to which the sitemap is uploaded eg: mys3bucket
- **base_path** - base url eg: / or /username/


## Setup using serverless and aws
1) npm install -g serverless
1) npm install
1) name your service and select region in `serverless.yml`
1) `serverless deploy` to create your stack (you may need to configure your aws access key and secret)

to deploy only the function to aws (quicker):
`serverless deploy -f sitemap` 



## Credits

inspired by https://github.com/Stockflare/lambda-sitemap-builder
and changed to get data from mysql and leverage async await

## Keywords

mysql nodejs lambda function async await node8
