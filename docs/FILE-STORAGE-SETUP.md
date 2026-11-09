# File storage setup (one time)

Uploaded files used to live in a folder inside the Render container, and that folder is **wiped on every redeploy or restart**.
They now go to an S3-compatible bucket instead. Cloudflare R2 is the easiest choice: a free tier (10 GB), no download fees,
and no credit-card surprises for small teams. AWS S3, Backblaze B2 and MinIO work the same way.

## Cloudflare R2
1. In the Cloudflare dashboard open **R2 Object Storage > Create bucket** (for example `taskis-files`). Leave it **private**.
2. **R2 > Manage API tokens > Create API token.** Permission: **Object Read & Write**, limited to that bucket.
   Copy the **Access Key ID**, the **Secret Access Key**, and the account endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. On Render, set these environment variables on the backend and redeploy:
   - `S3_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `S3_BUCKET` = the bucket name
   - `S3_ACCESS_KEY` = the Access Key ID
   - `S3_SECRET_KEY` = the Secret Access Key (keep it private; never commit it or paste it in chat)
   - `S3_REGION` = `auto` (the default; use the real region, e.g. `us-east-1`, for AWS S3)
4. The backend log should say `File storage: S3-compatible bucket '...'`. If it says `local disk` and warns about Render,
   one of the four values is missing.

Use a bucket that holds only Taskis files: the admin "self-destruct" action empties the whole bucket.

## What stays the same
- Files are encrypted **before** they leave the server, so the bucket only ever holds ciphertext. Keep `TASKIS_FILE_SECRET`
  (or `JWT_SECRET`) unchanged or stored files can no longer be opened.
- Chat, feed, avatar and attachment links do not change.

## Better than before, even on local disk
Uploads and downloads now stream in 1 MB pieces. Before, the whole file (up to 500 MB) was loaded into memory twice, which a
server with a 384 MB limit cannot do. A 300 MB file now goes through a 256 MB server cleanly. Files uploaded in the old
format still open.

## Moving existing files
Object names are the same as the file names in `backend/uploads`, so one command copies them, for example with the AWS CLI:
```bash
aws s3 sync backend/uploads s3://<bucket> --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```
Files that are only on Render's disk right now will be lost at the next deploy. If any matter, download them first.

## Tested how
Unit tests (encryption round trips, tampering, truncation, old-format files, Amazon's published signing example, a fake S3
server) and a 300 MB upload and download through both modes with the server limited to 256 MB. It has not yet been run
against a real Cloudflare R2 bucket, so do one upload and download in the app after you set it up.
