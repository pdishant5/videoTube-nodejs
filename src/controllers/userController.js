import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, "User does not exist!");
        }
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
    
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
    
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens!");
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const { username, email, fullname, password } = req.body;

    // validation
    if ([username, email, fullname, password].some((field) => (!field || field?.trim() === ""))) {
        throw new ApiError(400, "All fields are required!");
    }
    
    const existingUser = await User.findOne({
        $or: [{ username }, { email }]
    });
    
    if (existingUser) {
        throw new ApiError(409, "User with username or email already exists!");
    }
    
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverLocalPath = req.files?.coverImage?.[0]?.path;
    
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is missing!");
    }
    // const avatar = await uploadOnCloudinary(avatarLocalPath);

    // let coverImage = "";
    // if (coverLocalPath) {
    //     coverImage = await uploadOnCloudinary(coverLocalPath);
    // }

    // refractoring the above code..
    let avatar;
    try {
        avatar = await uploadOnCloudinary(avatarLocalPath);
        console.log("Avatar uploaded!");
    } catch (error) {
        console.log("Error uploading avatar!");
        throw new ApiError(500, "Failed to upload avatar!");
    }

    let coverImage;
    try {
        coverImage = await uploadOnCloudinary(coverLocalPath);
        console.log("Cover image uploaded!");
    } catch (error) {
        console.log("Error uploading cover image!");
        throw new ApiError(500, "Failed to upload cover image!");
    }

    try {
        const user = await User.create({
            username: username.toLowerCase(),
            email,
            fullname,
            password,
            avatar: avatar.url,
            coverImage: coverImage?.url || ""
        });
    
        const createdUser = await User.findById(user._id).select("-password -refreshToken");
    
        if (!createdUser) {
            throw new ApiError(500, "Something went wrong while registering the user!");
        }
        
        return res
            .status(201)
            .json(new ApiResponse(201, createdUser, "User registered successfully!"));
    } catch (error) {
        console.log("User registration failed!");
        
        if (avatar) {
            await deleteFromCloudinary(avatar.public_id);
        }
        if (coverImage) {
            await deleteFromCloudinary(coverImage.public_id);
        }
        throw new ApiError(500, "Something went wrong while registering the user and images were deleted!");
    }
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    // validation
    if (!email || email.trim() === "") {
        throw new ApiError(400, "Email is required!");
    }

    const user = await User.findOne({ $or: [{ email }, { username }] });
    if (!user) {
        throw new ApiError(404, "User not found!");
    }

    // validate password
    const isValidPassword = await user.isPasswordCorrect(password);
    if (!isValidPassword) {
        throw new ApiError(401, "Invalid password!");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    if (!loggedInUser) {
        throw new ApiError(500, "Something went wrong while logging in the user!");
    }

    const options = {
        httpOnly: true, // makes the cookie non-modifiable by the browser/client-side..
        secure: process.env.NODE_ENV === "production"
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        // .json(new ApiResponse(200, loggedInUser, "User logged in successfully!")); // This can work only in web applications..
        .json(new ApiResponse(
            200,
            { loggedInUser, accessToken, refreshToken },
            "User logged in successfully!"
        )); // We have to also pass the tokens like this in mobile applications..
});

const logoutUser = asyncHandler(async (req, res) => {
    // TODO: need to come back here after middleware
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out successfully!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Refresh token is required!");
    }
    
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        const user = await User.findById(decodedToken?._id);
        if (!user) {
            throw new ApiError(401, "Invalid refresh token!");
        }
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Invalid refresh token!");
        }
        
        const options = {
            httpOnly: true, // makes the cookie non-modifiable by the browser/client-side..
            secure: process.env.NODE_ENV === "production"
        };

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshToken(user._id);
        user.refreshToken = newRefreshToken;
        await user.save({ validateBeforeSave: false });

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(
                200,
                { accessToken, refreshToken: newRefreshToken },
                "Access token refreshed successfully!"
            ));
    } catch (error) {
        throw new ApiError(500, "Something went wrong while refreshing access token!");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found!");
    }

    const isValidPassword = await user.isPasswordCorrect(oldPassword);
    if (!isValidPassword) {
        throw new ApiError(401, "Invalid old password!");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully!"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(new ApiResponse(200, req.user, "Current user details!"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body;

    if (!fullname || fullname.trim() === "") {
        throw new ApiError(400, "Fullname is required!");
    }
    if (!email || email.trim() === "") {
        throw new ApiError(400, "Email is required!");
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: { 
                fullname: fullname.trim(),
                email: email.trim()
            }
        },
        { new: true }
    ).select("-password -refreshToken");

    return res.status(200).json(new ApiResponse(200, updatedUser, "Account details updated successfully!"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required!");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar.url) {
        throw new ApiError(500, "Something went wrong while uploading avatar!");
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password -refreshToken");

    return res.status(200).json(new ApiResponse(200, updatedUser, "Avatar updated successfully!"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image is required!");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage.url) {
        throw new ApiError(500, "Something went wrong while uploading cover image!");
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password -refreshToken");

    return res.status(200).json(new ApiResponse(200, updatedUser, "Cover image updated successfully!"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "Username is required!");
    }

    // aggregation pipeline to get user's channel profile
    const channelInfo = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase().trim()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                "subscribersCount": { $size: "$subscribers" },
                "channelsSubscribedToCount": { $size: "$subscribedTo" },
                "isSubscribed": { $cond: {
                    if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                    then: true,
                    else: false
                } }
            }
        },
        {
            // project only the required fields/necessary data..
            $project: {
                fullname: 1,
                username: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ]);

    if (!channelInfo?.length) {
        throw new ApiError(404, "Channel not found!");
    }

    return res.status(200).json(new ApiResponse(200, channelInfo[0], "Channel profile fetched successfully!"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
    // aggregation pipeline to fetch watch history of a user
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(String(req.user?._id))
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistroy",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        },{},{}
    ]);

    if (!user) {
        throw new ApiError(404, "User not found!");
    }

    return res.status(200).json(new ApiResponse(200, user[0].watchHistory, "Watch history fetched successfully!"));
});

export {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};