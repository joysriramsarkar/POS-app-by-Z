import re

with open("src/components/pos/TransactionHistory.tsx", "r") as f:
    content = f.read()

# 1. Update filter section
filter_old = """          <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-2">
            <div className="min-w-42.5 shrink-0 space-y-1">"""
filter_new = """          <div className="flex flex-col md:flex-row flex-nowrap items-end gap-2 md:overflow-x-auto pb-2 w-full">
            <div className="w-full md:min-w-42.5 shrink-0 space-y-1">"""
content = content.replace(filter_old, filter_new)

filter_old2 = """            <div className="min-w-37.5 shrink-0 space-y-1">
              <label className="text-xs md:text-sm font-medium">Transaction Status</label>"""
filter_new2 = """            <div className="w-full md:min-w-37.5 shrink-0 space-y-1">
              <label className="text-xs md:text-sm font-medium">Transaction Status</label>"""
content = content.replace(filter_old2, filter_new2)

filter_old3 = """            <div className="min-w-37.5 shrink-0 space-y-1">
              <label className="text-xs md:text-sm font-medium">Payment Method</label>"""
filter_new3 = """            <div className="w-full md:min-w-37.5 shrink-0 space-y-1">
              <label className="text-xs md:text-sm font-medium">Payment Method</label>"""
content = content.replace(filter_old3, filter_new3)

filter_old4 = """            <div className="min-w-30 shrink-0">
              <Button"""
filter_new4 = """            <div className="w-full md:min-w-30 shrink-0">
              <Button"""
content = content.replace(filter_old4, filter_new4)

# 2. Add overflow-x-auto to the table wrapper
# It's already there in the code: <div className="w-full overflow-x-auto">

with open("src/components/pos/TransactionHistory.tsx", "w") as f:
    f.write(content)
