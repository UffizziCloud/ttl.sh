# ttl.sh

## An ephemeral container registry for CI workflows.

## What is ttl.sh?

ttl.sh is an anonymous, expiring Docker container registry using the official Docker Registry image. This is a set of tools and configurations that can be used to deploy the registry without authentication, but with self-expiring images.

## Google Cloud Storage Bucket

Create a GCS Bucket in an appropriate GCP region. "Standard" storage class is good. Disable public access prevention. Uniform access control is fine. No protection tools are needed.

## GCP Service Account

Create a GCP Service Account within the same GCP Project as the GCS Bucket you just created. Grant it access specifically to the Bucket with the "Storage Admin" Role.

Create a key for the Service Account you just created. Keep this key secret! Encode the JSON key string using `base64 --wrap=0`. Keep this encoded string secret! You'll need this value to configure the `registry` container.
