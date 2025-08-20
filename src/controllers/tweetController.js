import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const { content } = req.body;

    if (!content?.trim()) {
        throw new ApiError(400, "Tweet is required!");
    }

    const tweet = await Tweet.create({
        content: content.trim(),
        owner: new mongoose.Types.ObjectId(String(req.user._id))
    });

    const createdTweet = await Tweet.findById(tweet._id).populate("owner");
    if (!createdTweet) {
        return new ApiError(500, "Something went wrong while uploading tweet!");
    }

    return res.status(201).json(new ApiResponse(201, createdTweet, "Tweet uploaded successfully!"));
});

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    const { userId } = req.params;
    const userTweets = await Tweet.find({ owner: new mongoose.Types.ObjectId(String(userId)) });

    if (userTweets.length === 0) {
        throw new ApiError(404, "No tweets found!");
    }

    return res.status(200).json(new ApiResponse(200, userTweets, "User tweets fetched successfully!"));
});

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const { tweetId } = req.params;
    const { newContent } = req.body;

    if (!tweetId) {
        throw new ApiError(400, "Tweet ID is required!");
    }
    if (!newContent?.trim()) {
        throw new ApiError(400, "New tweet is required!");
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content: newContent.trim()
            }
        },
        { new: true }
    ).populate("owner");

    return res.status(200).json(new ApiResponse(200, updatedTweet, "Tweet updated successfully!"));
});

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    const { tweetId } = req.params;

    if (!tweetId) {
        throw new ApiError(400, "Tweet ID is required!");
    }

    const deletedTweet = await Tweet.findByIdAndDelete(tweetId);

    return res.status(200).json(new ApiResponse(200, deletedTweet, "Tweet deleted successfully!"));
});

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
};