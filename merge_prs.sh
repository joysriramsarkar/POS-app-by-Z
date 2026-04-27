# রিপোজিটরির সমস্ত ওপেন PR-এর নম্বরগুলো খুঁজে বের করে লুপ চালানো হচ্ছে
for pr in $(gh pr list --state open --json number -q '.[].number'); do
    echo "PR #$pr মার্জ করা হচ্ছে..."
    
    # PR মার্জ করা এবং সাথে অরিজিনাল ব্রাঞ্চটি ডিলিট করে দেওয়া
    gh pr merge $pr --merge --delete-branch
done

echo "সবগুলো পুল রিকোয়েস্ট সফলভাবে মার্জ হয়েছে!"
